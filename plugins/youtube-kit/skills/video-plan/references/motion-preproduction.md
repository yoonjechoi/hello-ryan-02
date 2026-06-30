# 모션 프리프로덕션 — 화면·움직임 설계 (motion-preproduction)

> **언제:** 대본·샷(01_video-plan)과 **레퍼런스(경쟁사) 분석**이 끝난 다음, 라이브 빌드 **전에** 만든다.
> **왜:** 샷 리스트는 "무엇이 보이나"만 적는다. 빌드가 잘 나오려면 **"무엇이 어떻게 움직이나(모션)"** 를 먼저 설계해야 한다. 이 문서가 없으면 영상이 **스틸에 페이드만** 있는 밋밋한 결과가 된다(실측된 약점).
> **무엇으로 설계하나:** ① 경쟁사 분석(상위 영상이 쓴 모션·사운드) ② **HyperFrames 카탈로그**(`npx hyperframes catalog` — 쓸 블록/컴포넌트) ③ 내 브랜드 무드.
> **산출물:** `motion-preproduction.md`. 라이브 빌드(HyperFrames)는 샷 리스트가 아니라 **이 문서를 보고** 만든다.

---

## 1. 먼저 "모션 언어"를 한 줄로 정한다 (브랜드 결)
브랜드 무드 → 움직임 규칙. 예:
- **잔잔·미니멀(차·힐링·에디토리얼):** 느린 컷 3~6초, `sine.inOut` 이징, 소프트 디졸브, 켄번스 미세 줌, 절제된 자막. *(빠른 줌·하드컷·번쩍임 금지)*
- **밝고 빠름(브이로그·정보·세일즈):** 빠른 컷 1~3초, 통통 튀는 이징(`back`), 하드컷/와이프, 큰 키네틱 자막.
- **대담·임팩트(런칭·후킹):** 강한 줌/슬램, 키네틱 타이포, 대비 큰 색.
> 경쟁사 분석에서 관찰한 "그 니치가 실제로 쓰는 결"을 그대로 가져온다.

## 2. 공통 모션 기법 (대부분 영상에 적용)
- **켄번스(필수):** 모든 **정지 이미지**에 아주 느린 줌(예 1.00→1.05) 또는 미세 팬. *정적 스틸을 살아 있게.* 초점(`transform-origin`)은 그 샷의 피사체로. (카탈로그 블록 아님 → GSAP `scale`/`transformOrigin` 트윈.)
- **전환:** 잔잔=소프트 디졸브(opacity 크로스 0.5~0.8s) / 빠름·임팩트=카탈로그 전환(`grid-pixelate-wipe` 등).
- **자막:** 한 화면 한 줄, 강조어만 처리. 톤에 맞는 카탈로그 caption-* 또는 커스텀.
- **질감:** `vignette`(집중)·`grain-overlay`(필름 따뜻함) — 잔잔/시네마틱에 잘 맞음.
- **브랜드:** 워드마크/로고 리빌은 **맨 끝 여운**에(강매 니치일수록). `shimmer-sweep`로 광택 1회.

## 3. HyperFrames 카탈로그 매핑 (`npx hyperframes catalog`)
설계한 효과 ↔ 실제 설치할 블록을 1:1로 적는다. **블록=완성 장면(`add`), 컴포넌트=효과 조각(붙여넣기/`add`).**

| 효과 | 카탈로그 후보 | 비고 |
|---|---|---|
| 가장자리 집중 | `vignette` (component) | 거의 항상 |
| 필름 질감 | `grain-overlay` (component) | 따뜻/아날로그 |
| 자막 스타일 | `caption-weight-shift`(미니멀)·`caption-editorial-emphasis`(에디토리얼)·`caption-kinetic-slam`(임팩트)·`caption-highlight`(틱톡/소셜) | 톤 맞춰 1개 |
| 프리미엄 광택 | `shimmer-sweep` (component) | 브랜드 reveal 1회 |
| 텍스트 모핑 | `morph-text` | 키네틱 |
| 장면 전환 | `grid-pixelate-wipe` | 빠른·테크 톤만 |
| 로고 아웃트로 | `logo-outro` (block) | 브랜드 SVG로 교체해야 함 |
| 구독 로어서드 | `yt-lower-third` (block) | 유튜브 구독 유도 |
| 켄번스·디졸브 | (커스텀 GSAP) | 카탈로그에 없음 — 직접 |

⚠️ **브랜드와 안 맞는 건 의도적으로 배제하고 그 이유를 적는다.** (예: 잔잔한 차 브랜드에 `caption-glitch-rgb`·`neon`·`matrix`·`motion-blur`·`apple/finance/vpn` 류는 시끄러워 제외.)

## 4. 샷별 모션 설계표 (이 표가 핵심)
대본·샷의 각 구간에 아래를 채운다. **시간은 실제 오디오(녹음/TTS) 타이밍에 맞춘다.**

| # | 시간 | 화면(이미지) | **움직임(켄번스 방향·entrance·transition)** | 자막(스타일·위치·강조어) | 모션그래픽(카탈로그) | 사운드(BGM·SFX) |
|---|---|---|---|---|---|---|
| 0 콜드오픈 | … | … | 페이드인 + 미세 줌 시작 | (없음) | vignette on | 분위기 SFX 0.5s 먼저 |
| 1 훅 | … | … | 느린 줌인 | 중앙 큰 한 줄, 강조어 | caption-* | BGM in |
| … | … | … | 디졸브 + 켄번스 | … | … | 포인트 SFX |
| 끝 CTA | … | … | 가장 느린 줌, 정지 | (절제) | 워드마크+CTA칩 | BGM 페이드아웃 |

## 5. 사운드 설계 ("소리가 절반"인 니치는 필수)
- **BGM 1곡**(톤 맞춰, 음량 0.2~0.25, 끝 페이드아웃). 생성: ElevenLabs Music API(`POST /v1/music`) 또는 Suno/Udio/오디오보관함.
- **포인트 SFX**(각 샷 시점 `data-start`): 예 차 따르는 물소리·발소리·타건음·숨소리. 생성: ElevenLabs sound-generation(`POST /v1/sound-generation`).
- 음성(내레이션)은 항상 위(0.9~1.0). BGM·SFX가 안 묻히게.

## 6. 빌드로 넘기는 법 (HyperFrames)
- 정지 이미지 `.shot`마다 **GSAP 켄번스**(`gsap.set({transformOrigin}); tl.fromTo(el,{scale:from},{scale:to,duration:샷길이,ease:"sine.inOut"})`) + **디졸브**(opacity 크로스).
- 카탈로그 블록은 `npx hyperframes add <이름>`으로 설치 후 타임라인에 배치.
- 오디오는 **트랙별 `<audio class="clip" data-start data-duration data-volume>`** (voice/BGM/SFX 분리).
- 자막은 caption-* 컴포넌트 또는 커스텀(강조어 굵기).

> **핵심:** "샷 리스트(정적)"와 "모션 프리프로덕션(움직임 설계)"은 다르다. 후자가 있어야 영상이 산다. 경쟁사가 실제로 쓴 모션 + 카탈로그에서 고른 블록 + 브랜드 결 — 셋을 묶어 **샷별 움직임**으로 못 박는다.
