"""WP-021 font acquisition helper. Explicit manifest URLs; no system install.
Archives stay in ignored .cache; originals and licenses are copied only explicitly.
"""
import argparse, gzip, hashlib, html.parser, json, pathlib, re, shutil, struct, subprocess, urllib.request, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'font-acquisition'
DEST = ROOT / 'public' / 'fonts'

class Links(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []; self.current = None
    def handle_starttag(self, tag, attrs):
        if tag == 'a': self.current = [dict(attrs).get('href', ''), '']
    def handle_data(self, data):
        if self.current: self.current[1] += data
    def handle_endtag(self, tag):
        if tag == 'a' and self.current:
            self.links.append(self.current); self.current = None

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (WP-021 font selection)', 'Accept':'*/*'})
    with urllib.request.urlopen(req, timeout=60) as response:
        data = response.read()
        return gzip.decompress(data) if data.startswith(b'\x1f\x8b') else data

def page(url):
    data = fetch(url)
    for enc in ('utf-8', 'cp932'):
        try: return data.decode(enc)
        except UnicodeDecodeError: pass
    return data.decode('utf-8', errors='replace')

def inspect_font(path):
    data = path.read_bytes()
    if data[:4] not in (b'\x00\x01\x00\x00', b'OTTO', b'true'):
        raise ValueError('Only standalone original TTF/OTF supported')
    n = struct.unpack_from('>H', data, 4)[0]
    tables = {}
    for i in range(n):
        tag, _, off, size = struct.unpack_from('>4sIII', data, 12 + i*16)
        if off+size > len(data): raise ValueError('Truncated table')
        tables[tag.decode('ascii')] = (off, size)
    names = {}
    if 'name' in tables:
        off, _ = tables['name']; _, count, strings = struct.unpack_from('>HHH', data, off)
        for i in range(count):
            plat, enc, lang, name, length, pos = struct.unpack_from('>HHHHHH', data, off+6+i*12)
            if name not in (1,2,4,5,6,13,14): continue
            raw = data[off+strings+pos:off+strings+pos+length]
            try: value = raw.decode('utf-16-be' if plat in (0,3) else 'mac_roman')
            except UnicodeDecodeError: continue
            key = str(name)
            if key not in names or lang == 0x409: names[key] = value
    points = set(); glyph_map = {}
    if 'cmap' in tables:
        off, _ = tables['cmap']; count = struct.unpack_from('>H', data, off+2)[0]
        for i in range(count):
            plat, enc, sub = struct.unpack_from('>HHI', data, off+4+i*8)
            if plat != 0 and not (plat == 3 and enc in (1,10)): continue
            base = off + sub; fmt = struct.unpack_from('>H', data, base)[0]
            if fmt == 12:
                groups = struct.unpack_from('>I', data, base+12)[0]
                for j in range(groups):
                    start,end,glyph = struct.unpack_from('>III', data, base+16+j*12)
                    if end > 0x10ffff: raise ValueError('Bad cmap range')
                    for cp in range(start+(glyph == 0),end+1):
                        points.add(cp); glyph_map[cp]=glyph+cp-start
            elif fmt == 4:
                segments = struct.unpack_from('>H', data, base+6)[0] // 2
                ends = base+14; starts = ends+2*segments+2; deltas = starts+2*segments; offsets = deltas+2*segments
                for j in range(segments):
                    start = struct.unpack_from('>H',data,starts+j*2)[0]; end = struct.unpack_from('>H',data,ends+j*2)[0]
                    delta = struct.unpack_from('>h',data,deltas+j*2)[0]; offset = struct.unpack_from('>H',data,offsets+j*2)[0]
                    for cp in range(start,min(end,0xfffe)+1):
                        if offset:
                            location = offsets+j*2+offset+2*(cp-start)
                            if location+2 > len(data): raise ValueError('Bad cmap offset')
                            glyph = struct.unpack_from('>H',data,location)[0]
                            if glyph: glyph = (glyph+delta)&0xffff
                        else: glyph = (cp+delta)&0xffff
                        if glyph: points.add(cp); glyph_map[cp]=glyph
    # Some early design fonts map unimplemented characters to empty glyf slots.
    # A cmap mapping alone must not be advertised as a usable glyph.
    blank_points=set()
    if all(tag in tables for tag in ('glyf','loca','head','maxp')):
        head=tables['head'][0]; loca=tables['loca'][0]
        long_format=struct.unpack_from('>h',data,head+50)[0]==1
        count=struct.unpack_from('>H',data,tables['maxp'][0]+4)[0]
        offsets=[struct.unpack_from('>I' if long_format else '>H',data,loca+i*(4 if long_format else 2))[0]*(1 if long_format else 2) for i in range(count+1)]
        blank_points={cp for cp,glyph in glyph_map.items() if glyph>=count or offsets[glyph]==offsets[glyph+1]}
    visible_points=points-blank_points
    sample = '今日は何を描こう星降る夜の約束ドンッバキッあん!?…ー辻葛髙'
    return {'sha256':hashlib.sha256(data).hexdigest(), 'size':len(data), 'names':names,
        'cmapCount':len(points), 'emptyOutlineMappingCount':len(blank_points), 'kanjiCount':sum(0x4e00<=c<=0x9fff for c in visible_points),
        'hiraganaCount':sum(0x3041<=c<=0x3096 for c in visible_points), 'katakanaCount':sum(0x30a1<=c<=0x30fa for c in visible_points),
        'combiningDakuten':0x3099 in visible_points, 'puaCount':sum(0xe000<=c<=0xf8ff for c in visible_points),
        'hasGSUB':'GSUB' in tables, 'missingSample':''.join(c for c in sample if ord(c) not in visible_points)}

def safe_archive_name(name):
    path = pathlib.PurePosixPath(name.replace('\\','/'))
    if path.is_absolute() or '..' in path.parts or any(':' in part for part in path.parts): raise ValueError('Unsafe archive path')
    return path

def acquire(item):
    ident = item['id']
    if not re.fullmatch('[a-z0-9-]+',ident): raise ValueError('Bad id')
    folder = CACHE / ident; folder.mkdir(parents=True,exist_ok=True)
    archive = folder / 'download.zip'
    if not archive.exists(): archive.write_bytes(fetch(item['downloadUrl']))
    package = folder / 'package'; package.mkdir(exist_ok=True)
    if item.get('preExtracted') and item.get('select') and (package/item['select']).is_file():
        pass  # Caller has validated paths and used the OS archive reader.
    elif item.get('archive',True):
        with zipfile.ZipFile(archive) as zipped:
            if any(entry.compress_type==9 for entry in zipped.infolist()):
                for entry in zipped.infolist(): safe_archive_name(entry.filename)
                sevenzip=pathlib.Path('C:/Program Files/7-Zip/7z.exe')
                if not sevenzip.is_file(): raise ValueError('Deflate64 archive requires installed 7-Zip')
                subprocess.run([str(sevenzip),'x',str(archive),'-o'+str(package),'-y'],check=True,capture_output=True)
                return acquire({**item,'preExtracted':True})
            for entry in zipped.infolist():
                name = entry.filename
                if not entry.flag_bits & 0x800:
                    try: name = name.encode('cp437').decode('cp932')
                    except (UnicodeError,LookupError): pass
                relative = safe_archive_name(name)
                target = package.joinpath(*relative.parts)
                if entry.is_dir(): target.mkdir(parents=True,exist_ok=True)
                else:
                    target.parent.mkdir(parents=True,exist_ok=True)
                    target.write_bytes(zipped.read(entry))
    else:
        (package / item['filename']).write_bytes(archive.read_bytes())
    listing = [str(p.relative_to(package)) for p in package.rglob('*') if p.is_file()]
    result = {'id':ident,'archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':listing}
    if item.get('select'):
        source = package / item['select']
        if not source.is_file(): raise ValueError(f'Missing selected font {source}')
        target = DEST / ident / source.name; target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists() and target.read_bytes()!=source.read_bytes(): raise ValueError('Would overwrite different asset')
        shutil.copyfile(source,target)
        result['font'] = inspect_font(target); result['file'] = str(target.relative_to(DEST)).replace('\\','/')
        result['licenses'] = []
        for rel in item.get('licenses',[]):
            source_license = package / rel
            target_license = target.parent / source_license.name
            shutil.copyfile(source_license,target_license)
            result['licenses'].append(str(target_license.relative_to(DEST)).replace('\\','/'))
    return result

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('action',choices=['links','acquire','inspect']); parser.add_argument('input'); args=parser.parse_args()
    if args.action=='links':
        from urllib.parse import urljoin
        links=Links(); links.feed(page(args.input))
        print(json.dumps([{'text':re.sub(r'\s+',' ',text).strip(),'url':urljoin(args.input,url)} for url,text in links.links if re.search(r'\.(zip|ttf|otf)(\?|$)|download|dl=|851ch',url,re.I)],ensure_ascii=False,indent=2))
    elif args.action=='inspect': print(json.dumps(inspect_font(pathlib.Path(args.input)),ensure_ascii=False,indent=2))
    else:
        manifest=json.loads(pathlib.Path(args.input).read_text(encoding='utf-8'))
        results=[]
        for item in manifest:
            item={**item,**item.get('acquisition',{})}
            try: result=acquire(item)
            except Exception as error: result={'id':item['id'],'error':str(error)}
            results.append(result); print(json.dumps(result,ensure_ascii=False),flush=True)
        CACHE.mkdir(parents=True,exist_ok=True)
        (CACHE/'last-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
        if any('error' in r for r in results): raise SystemExit(1)

if __name__=='__main__': main()
