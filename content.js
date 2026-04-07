/**
 * Content Script - 쇼핑몰 상세 페이지에서 이미지 URL 추출
 * 각 쇼핑몰별 상세 이미지 컨테이너 셀렉터를 정의하여 이미지를 탐색합니다.
 */

(() => {
  // 쇼핑몰별 상세 이미지 셀렉터 정의
  const SITE_SELECTORS = {
    'oliveyoung.co.kr': {
      name: '올리브영',
      detailSelectors: [
        '#artcInfo img',
        '.prd_detail_box img',
        '#prdDetail img',
        '.goods_detail img',
        '.detail_info_area img',
        '.prd_detail_info img',
        '.cont_detail img'
      ]
    },
    'coupang.com': {
      name: '쿠팡',
      detailSelectors: [
        '.product-detail-content-inside img',
        '#productDetail img',
        '.prod-description img'
      ]
    },
    '11st.co.kr': {
      name: '11번가',
      detailSelectors: [
        '#productDetail img',
        '.l_product_detail_cont img',
        '.prd_detail img'
      ]
    },
    'gmarket.co.kr': {
      name: 'G마켓',
      detailSelectors: [
        '#detail_cont img',
        '.detail_cont img',
        '#vip_prd_detail img'
      ]
    },
    'auction.co.kr': {
      name: '옥션',
      detailSelectors: [
        '#detail_cont img',
        '.detail_cont img'
      ]
    },
    'ssg.com': {
      name: 'SSG',
      detailSelectors: [
        '.cdtl_capture_img img',
        '#cdtl_dtl_desc img',
        '.cdtl_sec_detail img'
      ]
    },
    'kurly.com': {
      name: '마켓컬리',
      detailSelectors: [
        '.product-detail img',
        '[class*="ProductDetailImage"] img'
      ]
    },
    'musinsa.com': {
      name: '무신사',
      detailSelectors: [
        '#detail_area img',
        '.product_detail_description img',
        '.product-img img'
      ]
    }
  };

  /**
   * 현재 사이트에 맞는 셀렉터 가져오기
   */
  function getSiteConfig() {
    const hostname = window.location.hostname;
    for (const [domain, config] of Object.entries(SITE_SELECTORS)) {
      if (hostname.includes(domain)) {
        return config;
      }
    }
    return null;
  }

  /**
   * 상세 이미지 URL 추출
   */
  function extractDetailImages() {
    const config = getSiteConfig();
    const images = new Set();
    
    if (config) {
      // 사이트별 셀렉터로 이미지 탐색
      for (const selector of config.detailSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(img => {
            const src = img.src || img.dataset.src || img.dataset.lazySrc || img.getAttribute('data-original');
            if (src && isValidDetailImage(src)) {
              images.add(src);
            }
          });
        } catch (e) {
          // 셀렉터 에러 무시
        }
      }
    }
    
    // 사이트 셀렉터로 못 찾은 경우 일반 탐색
    if (images.size === 0) {
      const allImgs = document.querySelectorAll('img');
      allImgs.forEach(img => {
        const src = img.src || img.dataset.src || img.dataset.lazySrc;
        if (src && isValidDetailImage(src) && isLikelyDetailImage(img)) {
          images.add(src);
        }
      });
    }

    return Array.from(images);
  }

  /**
   * 유효한 상세 이미지인지 확인
   */
  function isValidDetailImage(src) {
    if (!src || src.startsWith('data:')) return false;
    
    // 너무 작은 아이콘이나 배너 등 제외
    const excludePatterns = [
      /icon/i, /logo/i, /banner/i, /btn/i, /button/i,
      /arrow/i, /close/i, /search/i, /cart/i,
      /sprite/i, /blank\./i, /spacer/i, /pixel/i,
      /tracking/i, /analytics/i, /ad[_-]/i,
      /\.gif$/i, /\.svg$/i, /1x1/i
    ];

    return !excludePatterns.some(pattern => pattern.test(src));
  }

  /**
   * 상세 이미지일 가능성이 높은지 확인 (일반 탐색용)
   */
  function isLikelyDetailImage(img) {
    // 이미지가 충분히 큰지 확인 (최소 300px)
    const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width')) || 0;
    const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height')) || 0;
    
    if (width > 0 && width < 200) return false;
    if (height > 0 && height < 100) return false;
    
    return true;
  }

  // 메시지 리스너 - popup에서 이미지 추출 요청 시 응답
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractImages') {
      const images = extractDetailImages();
      const config = getSiteConfig();
      sendResponse({
        images: images,
        siteName: config ? config.name : '알 수 없는 사이트',
        pageTitle: document.title,
        pageUrl: window.location.href
      });
    }
    return true; // 비동기 응답을 위해 true 반환
  });
})();
