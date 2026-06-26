# 산출물 4종 기술 셸 명세 (output-specs)

> 깎기 1순위(두 실험 합의): 4종의 **기술 셸**(슬라이드 크기·hash 네비·필름스트립 등)이 어느 스킬에도 없어 매번 재발명·재현 실패. 여기에 박제한다.
> **원칙: 골드 셸을 복제 후 토큰만 교체한다.** 색·문구가 아니라 **구조·스크립트**를 그대로 가져온다.
>
> **골드 셸은 두 벌 — 무드에 맞는 쪽을 복제한다:**
> - **라이트(밝은 바탕):** `_workspace/brand-kit/hanmogeum/outputs/{web,ppt,cardnews,namecard}.html` (크림·명조·차 브랜드)
> - **다크(어두운 바탕):** `_workspace/brand-kit/simyasangyeong/outputs/{web,ppt,cardnews,namecard}.html` (밤·네온·굵은 산세리프, 검증됨)
>
> ⚠️ **다크 브랜드는 "토큰만 교체"로 안 끝난다 — 클래스의 *의미*도 재매핑해야 한다.** 라이트 골드를 다크로 옮기면 깨지니, **다크면 처음부터 다크 골드(simyasangyeong)를 복제**하라. 그래도 점검할 것:
> 1. 페이지/슬라이드 배경 토큰을 `--night`/`--surface`로(라이트 골드의 cream/paper 자리).
> 2. `.slide.light`(본문)·`.slide.dark`(표지) 등 **클래스 의미 재정의** — 다크 브랜드는 본문도 어두움(`.light`=night 배경).
> 3. 본문 텍스트는 밝게(`--text`), **강조어는 항상 네온(밝은 포인트 변형)** → 어두운 배경에 묻힘 방지.
> 4. CTA 푸터·명함 앞면·카드 1·5 등 "주색 배경" 자리는 `--brand`(딥 톤).

## 공통 (4종 전부)
- `<head>`에 `color-typography-specs.md`의 **link(폰트) + :root 토큰 + 공통 클래스를 그대로 인라인**. hex·폰트 변경 금지.
- 외부 이미지 0개(무드·심볼은 인라인 SVG/CSS). 폰트 CDN만 의존.
- **포인트색은 화면당 1곳.** 어두운 배경 위 강조어는 '밝은 포인트 변형' 사용(묻힘 방지).
- 단일 자체완결 HTML 1파일.

## ① web.html — 랜딩 한 페이지
- 중앙 ~1120px, 반응형 2 브레이크포인트. 섹션: 헤더(워드마크 좌상단+메뉴+CTA) → 히어로(슬로건 큰 디스플레이 폰트+보조카피+주 CTA 1개+무드 SVG) → 이야기(01_brand 사실만) → 제품 3카드 → 후기 1~2 → CTA 푸터(보통 다크).

## ② ppt.html — 회사소개 슬라이드 (가장 까다로움)
- **1280×720 슬라이드 6장.** `#stage`(1280×720)를 `transform:scale()`로 화면 중앙 자동 맞춤.
- **키보드 ←/→ 넘김 + `location.hash`(#1~#6)로 슬라이드 점프**(스크린샷 필수). 우하단 페이지표시(N/6). **좌하단 워드마크 작게**(전 슬라이드 공통, JS로 주입).
- 표지=주색(어두운) 배경+밝은 글자(로고도 밝게), 본문=밝은 배경.
- 핵심 JS(골드에서 복제):
```js
const stage=document.getElementById('stage'), els=[...document.querySelectorAll('.slide')];
let cur=0;
function show(n){cur=Math.max(0,Math.min(els.length-1,n));els.forEach((e,i)=>e.classList.toggle('on',i===cur));location.hash=cur+1;}
function fit(){stage.style.transform='scale('+Math.min(innerWidth/1280,innerHeight/720)+')';}
addEventListener('resize',fit);
addEventListener('keydown',e=>{if(['ArrowRight',' '].includes(e.key))show(cur+1);else if(e.key==='ArrowLeft')show(cur-1);});
addEventListener('hashchange',()=>{const n=parseInt(location.hash.slice(1))||1;if(n-1!==cur)show(n-1);});
fit();show((parseInt(location.hash.slice(1))||1)-1);
```
- 6장: 표지 · 문제 · 약속 · 제품 · 숫자/약속 · 맺음+연락처.

## ③ cardnews.html — 정사각 5장
- 카드 1장 = **1080×1080** 디자인. 5장을 **가로 필름스트립**으로(컨테이너에서 `transform:scale(--s)` ≈ .3 축소 → 한 화면에 5장 미리보기).
- 장당 한 메시지·큰 디스플레이 폰트·포인트색 강조 1곳·하단 워드마크. 1·5번은 주색 배경.
- 1 표지(슬로건) · 2 문제 · 3 전환 · 4 약속/제품 · 5 CTA+링크.

## ④ namecard.html — 명함 + 메일 서명
- 크림/밝은 배경 위 세로 배치: 명함 **앞면(900×500≈90×50mm, 주색 배경+밝은 워드마크+슬로건)** + **뒷면(밝은 배경, 이름 디스플레이 폰트·직함·연락처)** 가로 나란히 → 아래 **메일 서명 블록**(워드마크 작게 | 구분선 | 이름·직함·브랜드·슬로건·링크).
- 가상 정보는 "데모용 가상" 작게 표기.

## 빌더 게이트 체크 (제출 전)
- □ 4종 토큰이 `color-typography-specs.md`와 1:1 동일한가
- □ 포인트색이 주색과 다른 색상 계열이고 화면당 1곳인가
- □ 어두운 배경 위 강조어가 묻히지 않는가(밝은 변형 사용)
- □ ppt가 hash #1~#6로 점프되고 auto-fit 되는가
- □ 외부 이미지 0·폰트 CDN만인가
