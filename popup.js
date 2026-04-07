/**
 * Popup Script - 크롬 확장프로그램 팝업 로직
 * 이미지 추출, OCR 처리, 결과 표시를 관리합니다.
 */

// DOM 요소 참조
const elements = {
  statusArea: document.getElementById('status-area'),
  statusIcon: document.getElementById('status-icon'),
  statusText: document.getElementById('status-text'),
  imageListSection: document.getElementById('image-list-section'),
  imageList: document.getElementById('image-list'),
  imageCount: document.getElementById('image-count'),
  actionArea: document.getElementById('action-area'),
  extractBtn: document.getElementById('extract-btn'),
  selectAll: document.getElementById('select-all'),
  progressArea: document.getElementById('progress-area'),
  progressCount: document.getElementById('progress-count'),
  progressBar: document.getElementById('progress-bar'),
  progressDetail: document.getElementById('progress-detail'),
  resultArea: document.getElementById('result-area'),
  resultText: document.getElementById('result-text'),
  copyBtn: document.getElementById('copy-btn'),
  downloadBtn: document.getElementById('download-btn'),
  copyToast: document.getElementById('copy-toast'),
  errorArea: document.getElementById('error-area'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),
  helpLink: document.getElementById('help-link')
};

// 상태 관리
let state = {
  images: [],
  selectedImages: new Set(),
  extractedTexts: [],
  pageTitle: '',
  pageUrl: '',
  siteName: ''
};

/**
 * 초기화
 */
async function init() {
  try {
    // 현재 활성 탭 가져오기
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showError('활성 탭을 찾을 수 없습니다.');
      return;
    }

    // content script에 이미지 추출 요청
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractImages' });
      handleImageResponse(response);
    } catch (e) {
      // content script가 로드되지 않은 경우, 수동 주입
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        // 재시도
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractImages' });
        handleImageResponse(response);
      } catch (e2) {
        showError('이 페이지에서는 이미지를 추출할 수 없습니다. 쇼핑몰 상품 상세 페이지에서 사용해 주세요.');
      }
    }
  } catch (err) {
    showError('초기화 중 오류가 발생했습니다: ' + err.message);
  }
}

/**
 * 이미지 추출 응답 처리
 */
function handleImageResponse(response) {
  if (!response || !response.images || response.images.length === 0) {
    setStatus('warning', '상세 이미지를 찾지 못했습니다. 상품 상세 페이지인지 확인해 주세요.');
    return;
  }

  state.images = response.images;
  state.pageTitle = response.pageTitle || '';
  state.pageUrl = response.pageUrl || '';
  state.siteName = response.siteName || '';
  
  // 모든 이미지 기본 선택
  state.images.forEach((_, i) => state.selectedImages.add(i));

  setStatus('success', `${state.siteName} · ${state.images.length}개 상세 이미지 발견`);
  renderImageList();
  
  elements.imageListSection.classList.remove('hidden');
  elements.imageListSection.classList.add('fade-in');
  elements.actionArea.classList.remove('hidden');
  elements.actionArea.classList.add('fade-in');
}

/**
 * 상태 표시 업데이트
 */
function setStatus(type, text) {
  elements.statusText.textContent = text;
  elements.statusArea.className = 'status-area';
  
  if (type === 'loading') {
    elements.statusIcon.innerHTML = '<div class="spinner"></div>';
  } else if (type === 'success') {
    elements.statusArea.classList.add('status-success');
    elements.statusIcon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  } else if (type === 'warning') {
    elements.statusArea.classList.add('status-error');
    elements.statusIcon.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }
}

/**
 * 이미지 목록 렌더링
 */
function renderImageList() {
  elements.imageList.innerHTML = '';
  elements.imageCount.textContent = state.images.length;
  
  state.images.forEach((url, index) => {
    const filename = url.split('/').pop().split('?')[0];
    const item = document.createElement('div');
    item.className = `image-item ${state.selectedImages.has(index) ? 'selected' : ''}`;
    
    // 안전한 DOM 조작으로 요소 생성 (XSS 방지)
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.index = index;
    checkbox.checked = state.selectedImages.has(index);
    
    const thumb = document.createElement('img');
    thumb.className = 'image-thumb';
    thumb.src = url;
    thumb.alt = `이미지 ${index + 1}`;
    thumb.onerror = function() { this.style.display = 'none'; };
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'image-info';
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'image-name';
    nameDiv.textContent = `이미지 ${index + 1}`;
    
    const urlDiv = document.createElement('div');
    urlDiv.className = 'image-url';
    urlDiv.title = url;
    urlDiv.textContent = filename;
    
    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(urlDiv);
    item.appendChild(checkbox);
    item.appendChild(thumb);
    item.appendChild(infoDiv);
    
    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      checkbox.checked = !checkbox.checked;
      toggleImage(index, checkbox.checked);
    });
    
    checkbox.addEventListener('change', (e) => {
      toggleImage(index, e.target.checked);
    });
    
    elements.imageList.appendChild(item);
  });
}

/**
 * 이미지 선택/해제 토글
 */
function toggleImage(index, selected) {
  if (selected) {
    state.selectedImages.add(index);
  } else {
    state.selectedImages.delete(index);
  }
  
  const item = elements.imageList.children[index];
  if (item) {
    item.classList.toggle('selected', selected);
  }
  
  // 전체 선택 체크박스 상태 업데이트
  elements.selectAll.checked = state.selectedImages.size === state.images.length;
  elements.selectAll.indeterminate = state.selectedImages.size > 0 && state.selectedImages.size < state.images.length;
}

/**
 * 전체 선택/해제
 */
elements.selectAll.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  state.images.forEach((_, index) => {
    if (isChecked) {
      state.selectedImages.add(index);
    } else {
      state.selectedImages.delete(index);
    }
  });
  
  elements.imageList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = isChecked;
  });
  
  elements.imageList.querySelectorAll('.image-item').forEach(item => {
    item.classList.toggle('selected', isChecked);
  });
});

/**
 * 텍스트 추출 시작 - 별도 탭에서 OCR 처리 (팝업 닫힘 방지)
 */
elements.extractBtn.addEventListener('click', async () => {
  if (state.selectedImages.size === 0) {
    showError('추출할 이미지를 선택해 주세요.');
    return;
  }
  
  const selectedUrls = state.images.filter((_, i) => state.selectedImages.has(i));
  
  elements.extractBtn.disabled = true;
  elements.extractBtn.textContent = '탭 열는 중...';
  
  // 선택된 이미지 정보를 storage에 저장 후 새 탭에서 OCR 처리
  await chrome.storage.local.set({
    ocrTask: {
      images: selectedUrls,
      pageTitle: state.pageTitle,
      pageUrl: state.pageUrl,
      siteName: state.siteName,
      timestamp: Date.now()
    }
  });
  
  // 결과 페이지를 새 탭으로 열기 (팝업과 달리 클릭해도 안 닫힘)
  chrome.tabs.create({ url: chrome.runtime.getURL('result.html') });
});

/**
 * 이미지들에서 OCR 처리
 */
async function processImages(imageUrls) {
  state.extractedTexts = [];
  const total = imageUrls.length;
  
  updateProgress(0, total, 'OCR 엔진 초기화 중...');
  
  let worker;
  try {
    // Tesseract worker 생성 - Chrome Extension MV3에서는 wasm-unsafe-eval CSP 필요
    elements.progressDetail.textContent = 'Tesseract 워커 로딩 중...';
    
    worker = await Tesseract.createWorker('kor+eng', 1, {
      workerBlobURL: false,
      workerPath: chrome.runtime.getURL('libs/worker.min.js'),
      corePath: chrome.runtime.getURL('libs/tesseract-core.wasm.js'),
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      logger: m => {
        if (m.status === 'loading tesseract core') {
          elements.progressDetail.textContent = 'OCR 코어 로딩 중...';
        } else if (m.status === 'initializing tesseract') {
          elements.progressDetail.textContent = 'Tesseract 초기화 중...';
        } else if (m.status === 'loading language traineddata') {
          elements.progressDetail.textContent = '한국어 학습 데이터 다운로드 중...';
        } else if (m.status === 'initializing api') {
          elements.progressDetail.textContent = 'OCR API 준비 중...';
        } else if (m.status === 'recognizing text') {
          const imgProgress = Math.round(m.progress * 100);
          elements.progressDetail.textContent = `이미지 인식 중... ${imgProgress}%`;
        }
        console.log('[Tesseract]', m.status, m.progress);
      }
    });
    
    elements.progressDetail.textContent = 'OCR 엔진 준비 완료!';
  } catch (initErr) {
    console.error('Tesseract 초기화 실패:', initErr);
    showError('OCR 엔진 초기화에 실패했습니다. 확장프로그램을 다시 로드해 주세요.\n오류: ' + (initErr.message || '알 수 없는 오류'));
    return;
  }

  // 각 이미지에 대해 OCR 수행
  for (let i = 0; i < imageUrls.length; i++) {
    updateProgress(i, total, `이미지 ${i + 1}/${total} 처리 중...`);
    
    try {
      // 이미지를 canvas로 로드하여 data URL로 변환
      const dataUrl = await loadImageAsDataUrl(imageUrls[i]);
      
      const { data: { text } } = await worker.recognize(dataUrl);
      
      if (text.trim()) {
        state.extractedTexts.push({
          imageIndex: i + 1,
          imageUrl: imageUrls[i],
          text: text.trim()
        });
      }
    } catch (err) {
      console.error(`이미지 ${i + 1} 처리 실패:`, err);
      // err.message를 안전하게 처리 (XSS 방지)
      const safeMessage = String(err.message || '알 수 없는 오류').replace(/[<>"'&]/g, '');
      state.extractedTexts.push({
        imageIndex: i + 1,
        imageUrl: imageUrls[i],
        text: `[이미지 ${i + 1} 처리 실패: ${safeMessage}]`
      });
    }
  }
  
  await worker.terminate();
  
  updateProgress(total, total, '완료!');
  
  // 결과 표시
  setTimeout(() => {
    showResults();
  }, 500);
}

/**
 * 이미지를 Data URL로 로드
 */
function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        // CORS 실패 시 원본 URL 사용
        resolve(url);
      }
    };
    img.onerror = () => {
      // 이미지 로드 실패 시 원본 URL 시도
      resolve(url);
    };
    img.src = url;
  });
}

/**
 * 진행 상황 업데이트
 */
function updateProgress(current, total, detail) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  elements.progressCount.textContent = `${current}/${total}`;
  elements.progressBar.style.width = `${percent}%`;
  elements.progressDetail.textContent = detail;
}

/**
 * 결과 표시
 */
function showResults() {
  elements.progressArea.classList.add('hidden');
  elements.resultArea.classList.remove('hidden');
  elements.resultArea.classList.add('fade-in');
  
  if (state.extractedTexts.length === 0) {
    elements.resultText.textContent = '추출된 텍스트가 없습니다.';
    return;
  }
  
  // 안전한 DOM 조작으로 결과 구성 (innerHTML 대신 createElement 사용, XSS 방지)
  elements.resultText.innerHTML = '';
  state.extractedTexts.forEach((item) => {
    const separator = document.createElement('span');
    separator.className = 'result-separator';
    separator.textContent = `── 이미지 ${item.imageIndex} ──`;
    elements.resultText.appendChild(separator);
    elements.resultText.appendChild(document.createTextNode('\n'));
    
    const textNode = document.createTextNode(item.text + '\n\n');
    elements.resultText.appendChild(textNode);
  });
  
  setStatus('success', `총 ${state.extractedTexts.length}개 이미지에서 텍스트 추출 완료`);
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 전체 텍스트 가져오기 (복사/다운로드용)
 */
function getFullText() {
  const header = `[${state.siteName}] ${state.pageTitle}\n${state.pageUrl}\n추출 일시: ${new Date().toLocaleString('ko-KR')}\n${'='.repeat(50)}\n\n`;
  
  const body = state.extractedTexts.map(item => {
    return `── 이미지 ${item.imageIndex} ──\n${item.text}`;
  }).join('\n\n');
  
  return header + body;
}

/**
 * 텍스트 복사
 */
elements.copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(getFullText());
    
    // 버튼 피드백
    elements.copyBtn.classList.add('success');
    elements.copyBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M5 12l5 5L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      복사됨!
    `;
    
    // 토스트 표시
    elements.copyToast.classList.remove('hidden');
    setTimeout(() => {
      elements.copyToast.classList.add('hidden');
      elements.copyBtn.classList.remove('success');
      elements.copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2"/>
        </svg>
        복사
      `;
    }, 2000);
  } catch (err) {
    showError('클립보드 복사에 실패했습니다.');
  }
});

/**
 * 텍스트 파일 다운로드
 */
elements.downloadBtn.addEventListener('click', () => {
  const text = getFullText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const filename = `${state.siteName || '쇼핑몰'}_텍스트추출_${new Date().toISOString().slice(0, 10)}.txt`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
});

/**
 * 에러 표시
 */
function showError(message) {
  elements.errorArea.classList.remove('hidden');
  elements.errorArea.classList.add('fade-in');
  elements.errorText.textContent = message;
  setStatus('warning', '오류 발생');
}

/**
 * 다시 시도
 */
elements.retryBtn.addEventListener('click', () => {
  elements.errorArea.classList.add('hidden');
  elements.progressArea.classList.add('hidden');
  elements.resultArea.classList.add('hidden');
  elements.extractBtn.disabled = false;
  init();
});

/**
 * 사용법 링크
 */
elements.helpLink.addEventListener('click', (e) => {
  e.preventDefault();
  alert('사용법:\n\n1. 쇼핑몰 상품 상세 페이지로 이동합니다.\n2. 확장프로그램 아이콘을 클릭합니다.\n3. 발견된 이미지 목록에서 추출할 이미지를 선택합니다.\n4. "텍스트 추출 시작" 버튼을 클릭합니다.\n5. 추출이 완료되면 텍스트를 복사하거나 다운로드합니다.\n\n지원 쇼핑몰:\n올리브영, 쿠팡, 11번가, G마켓, 옥션, SSG, 마켓컬리, 무신사');
});

// 초기화 실행
init();
