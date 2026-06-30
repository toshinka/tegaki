import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// UI Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const playerContainer = document.getElementById('player-container');
const video = document.getElementById('video-preview');
const btnPlay = document.getElementById('btn-play');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration');
const seekBar = document.getElementById('seek-bar');

const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const btnSetStart = document.getElementById('btn-set-start');
const btnSetEnd = document.getElementById('btn-set-end');

const btnExport = document.getElementById('btn-export');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const fpsSelect = document.getElementById('fps-select');
const heightInput = document.getElementById('height-input');
const reverseCheckbox = document.getElementById('reverse-checkbox');
const hflipCheckbox = document.getElementById('hflip-checkbox');
const formatSelect = document.getElementById('format-select');
const audioCheckbox = document.getElementById('audio-checkbox');

const resultContainer = document.getElementById('result-container');
const resultGif = document.getElementById('result-gif');
const btnDownload = document.getElementById('btn-download');

// State
let currentFile = null;
let ffmpeg = null;

// Initialize FFmpeg
let ffmpegLoadPromise = null;

function initFFmpeg() {
  if (ffmpegLoadPromise) return ffmpegLoadPromise;
  
  ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg Log]', message);
  });
  
  ffmpeg.on('progress', ({ progress, time }) => {
    progressBar.value = progress * 100;
  });
  
  statusMessage.textContent = 'FFmpeg Coreをロード中...';
  ffmpegLoadPromise = ffmpeg.load({
    coreURL: '/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js',
    wasmURL: '/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',
  }).then(() => {
    statusMessage.textContent = '準備完了。生成ボタンを押してください。';
  }).catch(err => {
    console.error(err);
    statusMessage.textContent = 'FFmpegのロードに失敗しました。';
  });
  
  return ffmpegLoadPromise;
}

// ----------------------------------------------------------------------
// File loading
// ----------------------------------------------------------------------
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    const allowedImageTypes = ['image/gif', 'image/apng', 'image/webp'];
    if (file.type.startsWith('video/') || allowedImageTypes.includes(file.type)) {
      loadVideo(file);
    } else {
      alert('対応している動画ファイルまたは動く画像（GIF/WebP等）を選択してください。');
    }
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    loadVideo(e.target.files[0]);
  }
});

async function loadVideo(file) {
  currentFile = file;
  
  dropZone.classList.add('compact');
  playerContainer.classList.remove('hidden');
  resultContainer.classList.add('hidden');
  
  const isImage = file.type.startsWith('image/');
  
  if (isImage) {
    // 画像の場合はVideoタグで再生できないため、プレビュー用に一時的にMP4に変換する
    statusMessage.textContent = 'プレビュー用の動画を生成しています...';
    await initFFmpeg();
    try {
      const ext = file.name.substring(file.name.lastIndexOf('.'));
      const inputName = `preview_input${ext}`;
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      // x264は偶数サイズを要求するため scale=trunc(iw/2)*2:trunc(ih/2)*2 を指定
      await ffmpeg.exec([
        '-i', inputName, 
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', 
        '-c:v', 'libx264', 
        '-pix_fmt', 'yuv420p', 
        'preview.mp4'
      ]);
      const data = await ffmpeg.readFile('preview.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      video.src = URL.createObjectURL(blob);
      statusMessage.textContent = '準備完了。生成ボタンを押してください。';
    } catch (err) {
      console.error(err);
      statusMessage.textContent = 'プレビュー生成に失敗しました。';
    }
  } else {
    video.src = URL.createObjectURL(file);
    initFFmpeg(); // バックグラウンドでロード
  }
  
  video.onloadedmetadata = () => {
    seekBar.max = video.duration;
    durationDisplay.textContent = video.duration.toFixed(2);
    
    // Default range: up to 10 seconds
    startTimeInput.value = "0.00";
    endTimeInput.value = Math.min(video.duration, 10).toFixed(2);
  };
}

// ----------------------------------------------------------------------
// Player controls
// ----------------------------------------------------------------------
function togglePlay() {
  if (video.paused) {
    video.play();
    btnPlay.textContent = 'Pause (Space)';
  } else {
    video.pause();
    btnPlay.textContent = 'Play (Space)';
  }
}

btnPlay.addEventListener('click', togglePlay);

video.addEventListener('timeupdate', () => {
  if (!video.paused) {
    seekBar.value = video.currentTime;
  }
  currentTimeDisplay.textContent = video.currentTime.toFixed(2);
});

seekBar.addEventListener('input', () => {
  video.currentTime = parseFloat(seekBar.value);
});

// ----------------------------------------------------------------------
// Range setting
// ----------------------------------------------------------------------
btnSetStart.addEventListener('click', () => {
  startTimeInput.value = video.currentTime.toFixed(2);
});

btnSetEnd.addEventListener('click', () => {
  endTimeInput.value = video.currentTime.toFixed(2);
});

// ----------------------------------------------------------------------
// Keyboard shortcuts
// ----------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  // Prevent shortcuts if user is typing in an input field or video is not loaded
  if (playerContainer.classList.contains('hidden') || document.activeElement.tagName === 'INPUT') {
    return;
  }

  const FPS_STEP = 1 / 30; // Approx 1 frame at 30fps

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlay();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (!video.paused) video.pause();
      video.currentTime = Math.min(video.duration, video.currentTime + FPS_STEP);
      seekBar.value = video.currentTime;
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (!video.paused) video.pause();
      video.currentTime = Math.max(0, video.currentTime - FPS_STEP);
      seekBar.value = video.currentTime;
      break;
    case 'BracketLeft': // '['
      startTimeInput.value = video.currentTime.toFixed(2);
      break;
    case 'BracketRight': // ']'
      endTimeInput.value = video.currentTime.toFixed(2);
      break;
  }
});

// ----------------------------------------------------------------------
// Export logic
// ----------------------------------------------------------------------
btnExport.addEventListener('click', async () => {
  if (!ffmpeg || !currentFile) return;
  if (!ffmpeg.loaded) {
    alert('FFmpegの準備が完了していません。少々お待ちください。');
    return;
  }

  const start = parseFloat(startTimeInput.value);
  const end = parseFloat(endTimeInput.value);
  
  if (isNaN(start) || isNaN(end) || start >= end) {
    alert('開始時間と終了時間を正しく設定してください。');
    return;
  }
  
  const duration = (end - start).toFixed(2);
  const fps = fpsSelect.value;
  const height = heightInput.value;
  const isReverse = reverseCheckbox.checked;
  const isHflip = hflipCheckbox.checked;
  const format = formatSelect.value;
  const keepAudio = audioCheckbox.checked;
  
  btnExport.disabled = true;
  progressBar.style.display = 'block';
  progressBar.value = 0;
  
  try {
    statusMessage.textContent = 'メモリに動画を読み込んでいます...';
    // Use original extension for the input file
    const ext = currentFile.name.substring(currentFile.name.lastIndexOf('.'));
    const inputName = `input${ext}`;
    
    await ffmpeg.writeFile(inputName, await fetchFile(currentFile));
    
    let vf = `fps=${fps},scale=-1:${height}:flags=lanczos`;
    let af = '';
    
    if (isHflip) {
      vf = `hflip,${vf}`;
    }
    
    if (isReverse) {
      vf = `reverse,${vf}`;
      af = 'areverse';
    }
    
    const outputFile = `output.${format}`;
    let mimeType = '';
    
    statusMessage.textContent = '変換処理を実行中...';

    if (format === 'gif') {
      mimeType = 'image/gif';
      await ffmpeg.exec([
        '-ss', start.toString(),
        '-t', duration.toString(),
        '-i', inputName,
        '-vf', `${vf},palettegen`,
        'palette.png'
      ]);
      await ffmpeg.exec([
        '-ss', start.toString(),
        '-t', duration.toString(),
        '-i', inputName,
        '-i', 'palette.png',
        '-filter_complex', `${vf}[x];[x][1:v]paletteuse`,
        outputFile
      ]);
    } else {
      let args = [
        '-ss', start.toString(),
        '-t', duration.toString(),
        '-i', inputName,
        '-vf', vf,
      ];
      
      if (format === 'apng') {
        mimeType = 'image/apng';
        args.push('-plays', '0');
      } else if (format === 'webp') {
        mimeType = 'image/webp';
        args.push('-loop', '0');
      } else if (format === 'webm') {
        mimeType = 'video/webm';
        args.push('-c:v', 'libvpx-vp9', '-b:v', '1M');
      } else if (format === 'mp4') {
        mimeType = 'video/mp4';
        args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
      }
      
      if ((format === 'webm' || format === 'mp4') && keepAudio) {
        if (isReverse) {
          args.push('-af', af);
        }
      } else {
        args.push('-an');
      }
      
      args.push(outputFile);
      await ffmpeg.exec(args);
    }
    
    statusMessage.textContent = '生成完了！';
    const data = await ffmpeg.readFile(outputFile);
    
    const blob = new Blob([data.buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    if (format === 'webm' || format === 'mp4') {
      resultGif.style.display = 'none';
      let resultVideo = document.getElementById('result-video');
      if (!resultVideo) {
        resultVideo = document.createElement('video');
        resultVideo.id = 'result-video';
        resultVideo.controls = true;
        resultVideo.style.maxWidth = '100%';
        resultVideo.style.border = '1px solid #444';
        resultVideo.style.borderRadius = '4px';
        resultVideo.style.marginBottom = '1.5rem';
        resultGif.parentNode.insertBefore(resultVideo, btnDownload);
      }
      resultVideo.src = url;
      resultVideo.style.display = 'inline-block';
    } else {
      let resultVideo = document.getElementById('result-video');
      if (resultVideo) resultVideo.style.display = 'none';
      resultGif.style.display = 'inline-block';
      resultGif.src = url;
    }
    
    btnDownload.href = url;
    const basename = currentFile.name.substring(0, currentFile.name.lastIndexOf('.'));
    btnDownload.download = `${basename}_clip.${format}`;
    btnDownload.textContent = `${format.toUpperCase()}をダウンロード`;
    
    resultContainer.classList.remove('hidden');
    resultContainer.scrollIntoView({ behavior: 'smooth' });
    
  } catch (err) {
    console.error(err);
    statusMessage.textContent = 'エラーが発生しました。コンソールを確認してください。';
  } finally {
    btnExport.disabled = false;
    progressBar.style.display = 'none';
  }
});
