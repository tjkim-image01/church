# Side by Side — 문화예술교회 아트 스페이스

정적 사이트(HTML/CSS + 메뉴용 작은 JS)입니다. 서버나 프레임워크 없이 폴더째 어떤 정적 호스팅(GitHub Pages, Netlify, Cloudflare Pages, S3 등)에 올려도 됩니다.

## 구조

| 경로 | 내용 |
| --- | --- |
| `*.html` | 배포용 페이지 7개 (빌드 결과물) |
| `assets/css/<페이지>.css` | 페이지별로 미리 빌드한 Tailwind CSS |
| `assets/css/mobile.css`, `assets/js/menu.js` | 767px 이하 공통 상단 바·메뉴 |
| `assets/img/` | Stitch 시안 이미지 (로컬 저장본) |
| `_src/` | Stitch에서 받은 원본 HTML — **수정은 여기서** |
| `tools/build.mjs` | `_src` → 배포용 변환 스크립트 |
| `stitch.json` | Stitch 프로젝트·화면 ID (시안 수정 시 사용) |

페이지: `index`(메인) · `exhibition`(전시) · `artists`(작가 목록) · `artist`(작가 상세) · `webtoon`(웹툰) · `work`(작품 상세) · `about`(소개·모임·프로그램·오시는 길)

## 작업 방법

```bash
npm install        # 처음 한 번 (빌드 도구만 설치)
npm run build      # _src/*.html 수정 후 실행
npm run serve      # http://127.0.0.1:8765 에서 확인
```

빌드가 하는 일: Tailwind CDN 제거 후 CSS 파일로 빌드, 외부 이미지를 `assets/img`로 내려받기, `#앵커` 링크를 실제 페이지로 연결, 모바일 상단 바·메뉴 삽입.

## 남은 일

- 작가·작품·웹툰 내용은 Stitch가 만든 예시입니다. 실제 작가 데이터로 바꿔야 합니다.
- 작가 100명 목록·필터·검색은 화면만 있고 동작하지 않습니다 (데이터 형식 정한 뒤 구현).
- 작가 상세·작품 상세는 한 명/한 점짜리 견본 페이지입니다.
