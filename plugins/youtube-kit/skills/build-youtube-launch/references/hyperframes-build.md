# HyperFrames 빌드 플레이북 (hyperframes-build)

> **무엇:** `video-preproduction.md`(브랜드 영상 설계)를 받아 **라이브에서 HyperFrames로 영상을 조립·렌더**하는 구체 레시피.
> **왜 있나:** 이 함정들을 모르면 *무음·폴백 폰트·정적 스틸·아마추어 자막*이 나온다(실제로 다 겪음). 아래는 그 박제.
> 검증된 결과물: 한모금 1분 영상(켄번스·카탈로그 자막·BGM·SFX) — 이 수준이 목표.

## 0. 시작 (init)
```
HYPERFRAMES_SKIP_SKILLS=1 npx hyperframes init <name> --example warm-grain --audio <녹음.mp3> --language ko --non-interactive --resolution landscape
```
→ 녹음 음성 임포트 + **한국어 자동 전사**(자막 타이밍). 구조: `index.html`(루트) + `compositions/` + `assets/`. preview=`npm run dev`(롱러닝 → **백그라운드 실행**), 렌더=`npm run render`(~40초~2분).

## 1. ⚠️ 오디오는 명시적 `<audio>` (안 넣으면 무음 — 대표 함정)
설정/메타에 오디오가 자동으로 안 물린다. **트랙별 `<audio class="clip">`** 를 index에 직접:
```html
<audio class="clip" src="녹음.mp3"        data-start="0"  data-duration="<길이>" data-track-index="0" data-volume="1"></audio>   <!-- 음성 -->
<audio class="clip" src="assets/music/bgm.mp3" data-start="0" data-duration="<길이>" data-track-index="1" data-volume="0.22"></audio> <!-- BGM 작게 -->
<audio class="clip" src="assets/sfx/pour.mp3"  data-start="12.4" data-duration="5" data-track-index="6" data-volume="0.55"></audio> <!-- SFX는 샷 시점 -->
```
확인: 렌더 후 `ffprobe -show_entries stream=codec_type ...` 에 **`codec_type=audio`** 가 있어야 한다.

## 2. ⚠️ 폰트는 로컬 woff2 @font-face (CDN gh 경로는 404)
한글이 폴백되면 안 된다. Pretendard woff2를 받아 로컬 참조:
```
curl -sL "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-Bold.woff2"    -o assets/fonts/Pretendard-Bold.woff2
curl -sL "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2/Pretendard-Regular.woff2" -o assets/fonts/Pretendard-Regular.woff2
```
`@font-face{font-family:"Pretendard";font-weight:700;src:url("assets/fonts/Pretendard-Bold.woff2") format("woff2");}` 를 **index와 자막 컴포넌트 각각**에. 확인: 렌더 로그 `media + fonts ... ready`(FAILED 아님). (⚠️ `dist/web/static/woff2/...` 는 **gh가 아니라 npm** 경로가 200.)

## 3. ⭐ 카탈로그 컴포넌트를 **실제 설치해서** 쓴다 (커스텀으로 때우지 말 것)
> 가장 큰 실수였다: 카탈로그를 문서에만 적고 자막·모션을 손수 만들어 아마추어가 됐다. **반드시 `npx hyperframes add`로 설치해 응용한다.**
- 후보 보기 `npx hyperframes catalog` → 설치 `npx hyperframes add <이름>`.
- **자막:** `caption-weight-shift`(미니멀·굵기전환) 또는 `caption-editorial-emphasis`. → **한글화 패치(§4)**.
- **광택:** `shimmer-sweep` (워드마크에 `class="shimmer-sweep-target"` + `--shimmer-pos` 스윕).
- **구독 CTA:** `yt-lower-third`(끝 ~4.5초, 흰 구독 카드) — 한글화 후 `data-start`로 끝부분 배치. 로고 아웃트로가 필요하면 `logo-outro`(SVG 교체).
- **질감:** `vignette` + `grain-overlay`. **전환:** 잔잔=소프트 디졸브 / 빠름=`grid-pixelate-wipe`.
- ⚠️ 브랜드와 안 맞는 건 배제: `caption-glitch-rgb·neon·matrix·highlight(tiktok)·motion-blur·apple/finance/vpn` 등.

### 자막 컴포넌트 한글화 패치 (필수)
카탈로그 자막은 영문 폰트(Montserrat)+소문자라 한글이 깨진다. 설치 후 그 .html을:
- `Montserrat` → `Pretendard`(전부) + 로컬 @font-face 추가, `text-transform:lowercase`·`.toLowerCase()` 제거.
- `var DURATION` 과 `data-duration` 을 **영상 길이**로, light weight `300`→`400`(로컬 woff2가 400/700).
- `TRANSCRIPT`(단어별 {text,start,end})를 **우리 대본**으로 교체(§4).
- index의 자막 레이어를 `data-composition-src="compositions/components/<자막>.html"` 로 가리키고 `data-composition-id` 를 그 컴포넌트 id로 맞춘다.

**검증된 한글 레시피 (한모금에서 실제 사용):**
- **`caption-editorial-emphasis`**(에디토리얼·강조어): 평문 폰트→**Pretendard**, 강조 폰트(Playfair Display)→**한국 명조**(`@fontsource/nanum-myeongjo` woff2 로컬). `BLOCKS`(블록별 line1=평문`n`/line2=강조`e`)는 **각 구절의 마지막 단어를 `e`(강조)** 로 — 한국어는 끝 단어가 핵심·동사("지치죠?"·"기다렸어요"·"해봐요."). 단어를 구절(쉼표·문장부호·≤4어)로 끊어 자동 생성.
- **`caption-weight-shift`**(미니멀): Montserrat→Pretendard, 중앙 큰 한 줄·굵기 전환. 둘 중 톤 맞춰 택1.
- **`yt-lower-third`**(구독 CTA): `DM Sans`→Pretendard, 채널명·구독자줄·버튼(Subscribe→**구독**/Subscribed→**구독완료**) 한글화, `assets/avatar.jpg`→**브랜드 컷**(예: 찻잔 샷).

## 4. ⚠️ 한글 자막 transcript (whisper 한글이 깨질 수 있음)
`transcript.json`(whisper)이 invalid-UTF8/오타일 수 있다. → **깨끗한 원본 대본 + 문장 타이밍**으로 단어별 transcript를 직접 만든다(각 문장 [start,end]을 단어 글자수 비례로 분배). (문장 경계 초는 whisper에서 따오거나 직접.)

## 5. ⭐ 움직임 — 스틸을 살아 있게 (켄번스 + 디졸브)
정지 이미지에 페이드만 주면 밋밋하다. 샷마다:
```js
gsap.set(el, { transformOrigin: "50% 60%" });
tl.fromTo(el, { scale: 1.00 }, { scale: 1.06, duration: 샷길이, ease: "sine.inOut" }, 샷시작);  // 켄번스
tl.to(el, { opacity: 1, duration: 0.6 }, 샷시작); tl.to(el, { opacity: 0, duration: 0.6 }, 샷끝-0.3); // 소프트 디졸브
```
줌 방향은 피사체로(히어로는 더 느리게, 안도 장면은 줌아웃).

## 6. ⭐ 브랜드 룩 — 색 보정으로 통일
AI 이미지는 색온도가 제각각(차가운 노을 ↔ 따뜻한 차)이라 따로 논다. 샷 레이어에:
```css
.shot { filter: saturate(0.9) sepia(0.12) contrast(1.03) brightness(0.99); }       /* 한 팔레트로 */
[data-composition-id="shots"]::before { background: radial-gradient(...,rgba(216,182,134,.14),rgba(47,74,58,.20)); mix-blend-mode: soft-light; } /* 브랜드 톤 */
```

## 7. 레이어 z-order (track-index = 위로 갈수록 큰 수)
샷(2) < 비네트(3) < 자막(4) < 워드마크(5) < 그레인(100). 오디오는 track 0~ 자유. 자막은 비네트/색보정 **위**(안 어둡게), 그레인은 맨 위.

## 8. 사운드 생성 ("소리가 절반")
- **BGM:** ElevenLabs Music `POST https://api.elevenlabs.io/v1/music` body `{"prompt":"...","music_length_ms":40000}` (xi-api-key 헤더). 톤 맞춰 1곡, 음량 0.22.
- **SFX:** ElevenLabs `POST /v1/sound-generation` `{"text":"tea pouring ...","duration_seconds":5}`. 샷 시점에 `data-start`.
- 음성은 항상 위(1.0), BGM·SFX가 안 묻히게.

## 9. 검증 (눈·귀로 확인)
1. `npx hyperframes lint` → **에러 0**(특히 `font_family_without_font_face`).
2. `npm run render` → `ffprobe`로 **audio 스트림 확인**.
3. `npx hyperframes snapshot --at t1,t2,...` → 같은 샷 두 시점으로 **켄번스 줌 차이**, 자막·워드마크 눈으로 확인(contact-sheet.jpg).
   - ⚠️ snapshot은 *seek*라 GSAP `onStart`로 텍스트 set하는 자막이 한 프레임 빠질 수 있다(실제 재생·렌더는 정상).

## 10. 마무리 디테일
- **CTA 칩**은 짧게("🔖 저장하기"), 자막과 **위치 분리**(중복 스택 금지).
- **브랜드명·워드마크**는 끝 여운에(경쟁사 결). 슬로건이 제품 위에 겹치지 않게 위치 조정.
- 사람 녹음은 1.2배속으로 살짝 조여 또렷하게(글자수는 그 전제로).

> **요지:** 무음(§1)·폰트(§2)·**카탈로그 실제 사용(§3)**·켄번스(§5)·색보정(§6) — 이 다섯이 "아마추어 vs 프로"를 가른다. video-preproduction 설계 → 이 플레이북대로 빌드 → §9로 검증.
