/**
 * Result Page Script v3
 * OCR.space (무료, 추천) + Google Cloud Vision + Tesseract.js
 */

const els = {
  pageInfo: document.getElementById('page-info'),
  settingsSection: document.getElementById('settings-section'),
  engineStatus: document.getElementById('engine-status'),
  apiKeyArea: document.getElementById('api-key-area'),
  apiLabel: document.getElementById('api-label'),
  apiDescription: document.getElementById('api-description'),
  apiKeyInput: document.getElementById('api-key-input'),
  saveKeyBtn: document.getElementById('save-key-btn'),
  startBtn: document.getElementById('start-btn'),
  progressSection: document.getElementById('progress-section'),
  progressCount: document.getElementById('progress-count'),
  progressBar: document.getElementById('progress-bar'),
  progressStatus: document.getElementById('progress-status'),
  progressPercent: document.getElementById('progress-percent'),
  currentImage: document.getElementById('current-image'),
  currentImageLabel: document.getElementById('current-image-label'),
  resultSection: document.getElementById('result-section'),
  resultList: document.getElementById('result-list'),
  copyBtn: document.getElementById('copy-btn'),
  downloadBtn: document.getElementById('download-btn'),
  copyToast: document.getElementById('copy-toast'),
  errorSection: document.getElementById('error-section'),
  errorText: document.getElementById('error-text')
};

let taskData = null;
let extractedTexts = [];
let selectedEngine = 'ocrspace';

// ==========================================
// 초기화
// ==========================================

async function init() {
  try {
    const stored = await chrome.storage.local.get(['ocrTask', 'ocrSpaceKey', 'gcvApiKey', 'selectedEngine']);
    taskData = stored.ocrTask;

    if (!taskData || !taskData.images || taskData.images.length === 0) {
      showError('추출할 이미지 데이터가 없습니다. 팝업에서 다시 시도해 주세요.');
      return;
    }

    // 저장된 엔진 선택 복원
    selectedEngine = stored.selectedEngine || 'ocrspace';
    const radio = document.querySelector(`input[name="engine"][value="${selectedEngine}"]`);
    if (radio) {
      radio.checked = true;
      radio.closest('.engine-option').classList.add('selected');
    }

    // 저장된 API 키 복원
    if (stored.ocrSpaceKey) {
      els.apiKeyInput.value = stored.ocrSpaceKey;
    }
    if (stored.gcvApiKey && selectedEngine === 'gcv') {
      els.apiKeyInput.value = stored.gcvApiKey;
    }

    updateEngineUI();
    els.pageInfo.textContent = `${taskData.siteName} · ${taskData.images.length}개 이미지 · ${taskData.pageTitle}`;
    document.title = `텍스트 추출 - ${taskData.siteName}`;
    els.settingsSection.classList.remove('hidden');

  } catch (err) {
    showError('초기화 오류: ' + err.message);
  }
}

// ==========================================
// 엔진 선택 UI
// ==========================================

document.querySelectorAll('input[name="engine"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    selectedEngine = e.target.value;
    document.querySelectorAll('.engine-option').forEach(opt => opt.classList.remove('selected'));
    e.target.closest('.engine-option').classList.add('selected');
    updateEngineUI();
    // 엔진 선택 저장
    chrome.storage.local.set({ selectedEngine });
  });
});

function updateEngineUI() {
  if (selectedEngine === 'ocrspace') {
    els.apiKeyArea.style.display = 'block';
    els.apiLabel.textContent = 'OCR.space API 키 (무료)';
    els.apiDescription.innerHTML =
      '카드 등록 없이 무료 발급! 30초면 됩니다.<br>' +
      '<a href="https://ocr.space/ocrapi/freekey" target="_blank" rel="noopener"><strong>→ 무료 API 키 바로 발급받기</strong></a>';
    els.apiKeyInput.placeholder = 'K8... 형태의 API 키 입력';
    els.engineStatus.textContent = '🌐 OCR.space — 무료, 한국어 지원, 카드 등록 불필요';
    els.engineStatus.className = 'engine-status active';

    // 저장된 키 복원
    chrome.storage.local.get('ocrSpaceKey', (r) => {
      if (r.ocrSpaceKey) els.apiKeyInput.value = r.ocrSpaceKey;
      else els.apiKeyInput.value = '';
    });

  } else if (selectedEngine === 'gcv') {
    els.apiKeyArea.style.display = 'block';
    els.apiLabel.textContent = 'Google Cloud Vision API 키';
    els.apiDescription.innerHTML =
      '최고 정확도! 단, 결제 수단(카드) 등록이 필요합니다.<br>' +
      '<a href="https://console.cloud.google.com/apis/library/vision.googleapis.com" target="_blank" rel="noopener">→ API 키 발급 방법</a>';
    els.apiKeyInput.placeholder = 'AIza... 형태의 API 키 입력';
    els.engineStatus.textContent = '☁️ Google Cloud Vision — 최고 정확도, 결제 수단 필요';
    els.engineStatus.className = 'engine-status active';

    chrome.storage.local.get('gcvApiKey', (r) => {
      if (r.gcvApiKey) els.apiKeyInput.value = r.gcvApiKey;
      else els.apiKeyInput.value = '';
    });

  } else {
    els.apiKeyArea.style.display = 'none';
    els.engineStatus.textContent = '🔧 Tesseract.js — API 키 불필요, 오프라인 동작, 낮은 한국어 정확도';
    els.engineStatus.className = 'engine-status inactive';
  }
}

// ==========================================
// API 키 저장
// ==========================================

els.saveKeyBtn.addEventListener('click', async () => {
  const key = els.apiKeyInput.value.trim();
  if (!key) return;

  if (selectedEngine === 'ocrspace') {
    await chrome.storage.local.set({ ocrSpaceKey: key });
  } else if (selectedEngine === 'gcv') {
    await chrome.storage.local.set({ gcvApiKey: key });
  }

  els.saveKeyBtn.textContent = '✓ 저장됨';
  setTimeout(() => { els.saveKeyBtn.textContent = '저장'; }, 1500);
});

// ==========================================
// 추출 시작
// ==========================================

els.startBtn.addEventListener('click', async () => {
  // API 키 검증
  if (selectedEngine !== 'tesseract') {
    const key = els.apiKeyInput.value.trim();
    if (!key) {
      alert('API 키를 입력해 주세요!');
      els.apiKeyInput.focus();
      return;
    }
    // 자동 저장
    if (selectedEngine === 'ocrspace') {
      await chrome.storage.local.set({ ocrSpaceKey: key });
    } else {
      await chrome.storage.local.set({ gcvApiKey: key });
    }
  }

  els.startBtn.disabled = true;
  els.settingsSection.classList.add('hidden');
  els.progressSection.classList.remove('hidden');

  try {
    await processImages(taskData.images);
    await chrome.storage.local.remove('ocrTask');
  } catch (err) {
    showError('처리 중 오류: ' + err.message);
  }
});

// ==========================================
// OCR.space API
// ==========================================

async function ocrWithOcrSpace(imageDataUrl) {
  const apiKey = els.apiKeyInput.value.trim();

  const formData = new FormData();
  formData.append('apikey', apiKey);
  formData.append('base64Image', imageDataUrl);
  formData.append('language', 'kor');
  formData.append('OCREngine', '2');        // Engine 2가 아시아 언어에 더 좋음
  formData.append('isTable', 'true');        // 표 구조 인식 향상
  formData.append('scale', 'true');          // 이미지 자동 확대
  formData.append('detectOrientation', 'true');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`OCR.space API 오류 (${response.status})`);
  }

  const data = await response.json();

  if (data.IsErroredOnProcessing) {
    const errMsg = data.ErrorMessage?.[0] || '알 수 없는 오류';
    throw new Error(`OCR.space 처리 오류: ${errMsg}`);
  }

  const results = data.ParsedResults;
  if (!results || results.length === 0) {
    return '';
  }

  return results.map(r => r.ParsedText || '').join('\n');
}

// ==========================================
// Google Cloud Vision API
// ==========================================

async function ocrWithCloudVision(imageDataUrl) {
  const apiKey = els.apiKeyInput.value.trim();
  const base64 = imageDataUrl.split(',')[1];

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        imageContext: { languageHints: ['ko', 'en'] }
      }]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData?.error?.message || response.statusText;
    throw new Error(`Cloud Vision API 오류 (${response.status}): ${errMsg}`);
  }

  const data = await response.json();
  const annotations = data.responses?.[0]?.textAnnotations;
  if (!annotations || annotations.length === 0) return '';
  return annotations[0].description || '';
}

// ==========================================
// Tesseract.js OCR
// ==========================================

async function ocrWithTesseract(imageUrls) {
  const total = imageUrls.length;

  const worker = await Tesseract.createWorker('kor+eng', 1, {
    workerBlobURL: false,
    workerPath: chrome.runtime.getURL('libs/worker.min.js'),
    corePath: chrome.runtime.getURL('libs/tesseract-core.wasm.js'),
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: m => {
      if (m.status === 'loading language traineddata') {
        updateProgress(0, total, '한국어 학습 데이터 다운로드 중...', 0);
      } else if (m.status === 'recognizing text') {
        const pct = Math.round(m.progress * 100);
        els.currentImageLabel.textContent = `텍스트 인식 중... ${pct}%`;
      }
    }
  });

  for (let i = 0; i < imageUrls.length; i++) {
    const percent = Math.round((i / total) * 100);
    updateProgress(i, total, `이미지 ${i + 1}/${total} (Tesseract)...`, percent);
    els.currentImage.src = imageUrls[i];

    try {
      const processed = await loadAndPreprocessImage(imageUrls[i]);
      const { data: { text } } = await worker.recognize(processed);
      const cleaned = cleanOcrText(text);
      if (cleaned) {
        extractedTexts.push({ imageIndex: i + 1, imageUrl: imageUrls[i], text: cleaned });
      }
    } catch (err) {
      console.error(`이미지 ${i + 1} 실패:`, err);
    }
  }

  await worker.terminate();
}

// ==========================================
// 메인 처리
// ==========================================

async function processImages(imageUrls) {
  extractedTexts = [];
  const total = imageUrls.length;

  if (selectedEngine === 'tesseract') {
    updateProgress(0, total, 'Tesseract 초기화 중...', 0);
    try {
      await ocrWithTesseract(imageUrls);
    } catch (err) {
      showError('Tesseract 오류: ' + err.message);
      return;
    }
  } else {
    // OCR.space 또는 Google Cloud Vision
    const engineName = selectedEngine === 'ocrspace' ? 'OCR.space' : 'Cloud Vision';
    updateProgress(0, total, `${engineName} API로 처리 중...`, 0);

    for (let i = 0; i < imageUrls.length; i++) {
      const percent = Math.round((i / total) * 100);
      updateProgress(i, total, `이미지 ${i + 1}/${total} 처리 중...`, percent);
      els.currentImage.src = imageUrls[i];
      els.currentImageLabel.textContent = `${engineName} API 호출 중...`;

      try {
        const dataUrl = await loadImageAsDataUrl(imageUrls[i]);
        let text = '';

        if (selectedEngine === 'ocrspace') {
          text = await ocrWithOcrSpace(dataUrl);
        } else {
          text = await ocrWithCloudVision(dataUrl);
        }

        const cleaned = cleanOcrText(text);
        if (cleaned) {
          extractedTexts.push({ imageIndex: i + 1, imageUrl: imageUrls[i], text: cleaned });
        }
        els.currentImageLabel.textContent = '✓ 완료';
      } catch (err) {
        console.error(`이미지 ${i + 1} 실패:`, err);
        const safeMsg = String(err.message || '').replace(/[<>"'&]/g, '');
        extractedTexts.push({
          imageIndex: i + 1,
          imageUrl: imageUrls[i],
          text: `[이미지 ${i + 1} 처리 실패: ${safeMsg}]`
        });
      }

      // OCR.space 무료 티어 속도 제한 (초당 1건)
      if (selectedEngine === 'ocrspace' && i < imageUrls.length - 1) {
        els.currentImageLabel.textContent = '잠시 대기 중 (API 속도 제한)...';
        await sleep(1100);
      }
    }
  }

  // 완료
  updateProgress(total, total, '✅ 추출 완료!', 100);
  els.progressSection.classList.add('progress-complete');
  document.title = `추출 완료 - ${taskData.siteName}`;
  showResults();
}

// ==========================================
// 유틸리티
// ==========================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try { resolve(canvas.toDataURL('image/png')); }
      catch (e) { resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

function loadAndPreprocessImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.max(img.naturalWidth, img.naturalHeight) < 1000 ? 2 : 1;
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray = Math.max(0, Math.min(255, 128 + 1.4 * (gray - 128)));
          data[i] = data[i + 1] = data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) { resolve(url); }
    };
    img.onerror = () => resolve(url);
    img.src = url;
  });
}

function cleanOcrText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

function updateProgress(current, total, status, percent) {
  els.progressCount.textContent = `${current}/${total}`;
  els.progressBar.style.width = `${percent}%`;
  els.progressStatus.textContent = status;
  els.progressPercent.textContent = `${percent}%`;
}

function showResults() {
  els.resultSection.classList.remove('hidden');
  if (extractedTexts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'result-item';
    const emptyText = document.createElement('div');
    emptyText.className = 'result-item-text';
    emptyText.textContent = '추출된 텍스트가 없습니다.';
    empty.appendChild(emptyText);
    els.resultList.appendChild(empty);
    return;
  }

  extractedTexts.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'result-item';

    const header = document.createElement('div');
    header.className = 'result-item-header';
    const title = document.createElement('div');
    title.className = 'result-item-title';
    const numSpan = document.createElement('span');
    numSpan.className = 'img-number';
    numSpan.textContent = item.imageIndex;
    title.appendChild(numSpan);
    title.appendChild(document.createTextNode(` 이미지 ${item.imageIndex}`));

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-single-btn';
    copyBtn.textContent = '복사';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(item.text).then(() => {
        copyBtn.textContent = '✓ 복사됨';
        setTimeout(() => { copyBtn.textContent = '복사'; }, 1500);
      });
    });

    header.appendChild(title);
    header.appendChild(copyBtn);

    const textDiv = document.createElement('div');
    textDiv.className = 'result-item-text';
    textDiv.textContent = item.text;

    card.appendChild(header);
    card.appendChild(textDiv);
    els.resultList.appendChild(card);
  });

  els.resultSection.scrollIntoView({ behavior: 'smooth' });
}

function getFullText() {
  const header = `[${taskData.siteName}] ${taskData.pageTitle}\n${taskData.pageUrl}\n추출 일시: ${new Date().toLocaleString('ko-KR')}\n${'='.repeat(50)}\n\n`;
  const body = extractedTexts.map(item => `── 이미지 ${item.imageIndex} ──\n${item.text}`).join('\n\n');
  return header + body;
}

els.copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(getFullText());
    els.copyBtn.classList.add('success');
    els.copyBtn.textContent = '✓ 복사 완료!';
    els.copyToast.classList.remove('hidden');
    setTimeout(() => {
      els.copyToast.classList.add('hidden');
      els.copyBtn.classList.remove('success');
      els.copyBtn.textContent = '전체 복사';
    }, 2000);
  } catch (err) { showError('복사 실패'); }
});

els.downloadBtn.addEventListener('click', () => {
  const text = getFullText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const filename = `${taskData.siteName || '쇼핑몰'}_텍스트추출_${new Date().toISOString().slice(0, 10)}.txt`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
});

function showError(message) {
  els.errorSection.classList.remove('hidden');
  els.errorText.textContent = message;
}

// 시작
init();
