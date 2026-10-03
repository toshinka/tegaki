"""Assemble WP-021 catalog from reviewed metadata and original asset inspection.
No font conversion; acquisition manifests and source licenses remain reproducible.
"""
import html.parser, importlib.util, json, pathlib
spec=importlib.util.spec_from_file_location('acquire',pathlib.Path(__file__).with_name('acquire-curated-fonts.py'))
acquire=importlib.util.module_from_spec(spec); spec.loader.exec_module(acquire)
DEST, CACHE, inspect_font, page=acquire.DEST, acquire.CACHE, acquire.inspect_font, acquire.page

class Text(html.parser.HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style'): self.skip+=1
        if tag in ('p','li','h1','h2','h3','br','hr'): self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script','style'): self.skip=max(0,self.skip-1)
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)

def license_snapshot(url, target):
    parser=Text(); parser.feed(page(url))
    text='\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())
    target.write_text('Source: '+url+'\nRetrieved: 2026-10-03\n\n'+text+'\n',encoding='utf-8')

def main():
    metadata=json.loads(pathlib.Path(__file__).with_name('curated-font-selection.json').read_text(encoding='utf-8'))
    acquisitions=[]; rows=[]
    for meta in metadata:
        folder=DEST/meta['id']
        files=list(folder.glob('*.ttf'))+list(folder.glob('*.otf'))
        if len(files)!=1: raise ValueError('Expected one original font: '+meta['id'])
        font=files[0]; info=inspect_font(font)
        lic=folder/meta.get('licenseFileName','LICENSE-UTF8.txt')
        if not lic.exists():
            if meta.get('snapshotLicense'): license_snapshot(meta['licenseUrl'],lic)
            else:
                original=folder/meta['originalLicense']
                raw=original.read_bytes()
                try: text=raw.decode('utf-8-sig')
                except UnicodeDecodeError: text=raw.decode('cp932')
                lic.write_text(text,encoding='utf-8')
        row={k:v for k,v in meta.items() if k not in ('originalLicense','snapshotLicense','licenseFileName','acquisition','licenseNotice')}
        row.update(file=font.relative_to(DEST).as_posix(),ext=font.suffix[1:],
            family='Tegaki_'+meta['id'].replace('-','_'),licenseFile=lic.relative_to(DEST).as_posix(),
            sha256=info['sha256'],size=info['size'],version=info['names'].get('5','unknown'))
        row['coverage']=meta.get('coverage',f"漢字{info['kanjiCount']:,}字 / ひらがな{info['hiraganaCount']} / カタカナ{info['katakanaCount']}")
        row['dakuten']=meta.get('dakuten',('結合濁点U+3099あり・組版未検証' if info['combiningDakuten'] else '結合濁点U+3099なし・漫画外字未確認'))
        package=meta.get('acquisition',{})
        archive=CACHE/meta['id']/'download.zip'
        sourceHash=acquire.hashlib.sha256(archive.read_bytes()).hexdigest() if archive.exists() else None
        rows.append(row); acquisitions.append({'id':meta['id'],'downloadUrl':meta['downloadUrl'],'archiveSha256':sourceHash,
            'selectedOriginal':package.get('select'), 'licenseNotice':meta.get('licenseNotice',''), 'inspection':info})
    (DEST/'catalog.json').write_text(json.dumps({'version':1,'primaryId':'bundled-genei-antique','fonts':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (DEST/'inspection.json').write_text(json.dumps({'inspectedAt':'2026-10-03','fonts':acquisitions},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Catalog: {len(rows)} fonts, {sum(r["size"] for r in rows)/1048576:.1f} MiB')

if __name__=='__main__': main()
