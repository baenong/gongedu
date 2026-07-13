<p align="center">
  <img src="./.github/assets/brightness.svg" width="128">
</p>

<hr>

<p align="center">
  <img src="./.github/assets/logo-white.svg" width="225">
  <br><u><strong>#k-ai-champion</strong></u>
  <br><i>"공직자 1시간은, 5200만 시간 가치"</i>
  <br>
  <br><strong>공무원 필수교육, 이제 한 곳에서 관리합니다.</strong>
  <br>각 직원이 이수증을 올리면 AI가 자동으로 검수하고, 담당자는 한 눈에 이수 현황을 파악할 수 있습니다.
  <br><br> - 전북특별자치도 군산시 행정지원과 안민수 -
</p>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/Typescript-5.9.3-blue.svg" /></a>
  <img src="https://img.shields.io/badge/Node-22-339933.svg?logo=node.js&logoColor=white" />
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-배포-2496ED.svg?logo=docker&logoColor=white" /></a>
  <img src="https://img.shields.io/badge/version-0.9.6-orange.svg"/>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT" /></a>
</p>

---

## 왜 만들었나요?

공무원은 매년 십수 개의 필수교육을 이수하고 있으며 점차 이수해야 할 필수교육이 증가하고 있습니다.
<br><br>본연의 업무를 수행하느라 교육마다 본인이 이수했는지 여부를 기억하지 못하고 마감기한을 놓칠 때도 있습니다.
<br><br>부서담당자는 각 부서원이 제출했는지 확인하고 취합하는 과정에서 실수로 누락할 수도, 이미 제출한 직원에게 다시 요청할 때도 있습니다.

<span style="font-style:italic;"><strong>"내가 이걸 들었던가? 수료증을 냈던가?"</strong></span>

업무만으로도 바쁜 공무원들이 매번 체크하느라 낭비되는 시간들이 아까워 2025년 하반기에 개발하여 팀 내에서 운영하던 시스템을 좀 더 일반적으로 사용할 수 있도록 수정하여 배포합니다.

제출된 수료증이 실제로 해당 교육의, 본인 명의 수료증인지 담당자가 일일이 열어보고 확인하는 부담을 경감시키고자 AI가 이를 자동으로 1차 검증해주는 기능을 추가했습니다.

현재 기관 시범 운영 예정으로, 운영 중 발견되는 문제나 피드백을 반영해 지속적으로 개정할 예정입니다.

---

## 도입 효과

연간 필수교육 **15개**, 담당 부서 **80개**를 기준으로 도입 전후를 비교하면 다음과 같습니다.

**도입 전** — 교육 1개당 담당자 업무 흐름

1. 필수이수교육 접수 시 전 직원 공지
2. 마감기한이 다가오면 미제출자에게 재안내
3. 쪽지·메일 등으로 개별 제출된 수료증 수집 (중복 제출 여부 확인 포함)
4. 미제출자 목록 직접 확인 후 개별 추가 안내
5. 전체 취합 후 제출

**도입 후** — 교육 1개당 담당자 업무 흐름

1. 실시간 이수 현황 조회로 미제출자 즉시 확인
2. 별도 취합 절차없이 ZIP 일괄 다운로드로 제출 완료
3. 계정 기반 수료증 관리로 부서이동하더라도 자동으로 연계
   ▶ 인사이동으로 인한 수료증 누락 확인/중복 제출 등 예방

| 구분    | 교육당 소요시간 | 연간 총 소요시간                       |
| ------- | --------------- | -------------------------------------- |
| 도입 전 | 약 60분/부서    | **1,200시간** (60분 × 15교육 × 80부서) |
| 도입 후 | 약 5분/부서     | **100시간** (5분 × 15교육 × 80부서)    |

> 비슷한 규모의 기관이라면 **연간 약 1,100시간**을 절감할 수 있을 것으로 기대됩니다.

---

## AI 기반 수료증 자동 검증

담당자가 제출된 수료증 파일을 직접 열어 진위와 명의를 확인하던 과정을 AI가 대신합니다.
![AI 검증](./.github/assets/10%20ai-verify.gif)

- 수료증 업로드 시 AI가 파일(이미지·PDF)을 읽고 다음 항목들을 1차적으로 검증합니다.
  - 실제 수료증/이수증이 맞는지
  - 신청한 교육과정과 일치하는지
  - 제출자 본인이 맞는지
  - 제출연도가 일치하는지

- 판단 결과 의심스러운 부분이 있으면 이수 현황 화면에 경고로 표시되어, 담당자는 이상이 있는 건을 골라 확인하면 됩니다.
- AI 서비스 장애나 오판단 가능성을 감안해, 검증에 실패하거나 시간이 걸리더라도 수료증 제출 자체는 항상 정상적으로 처리됩니다. **AI는 어디까지나 담당자의 확인 부담을 줄여주는 보조 수단이며, 최종 판단과 책임은 담당자에게 있습니다.**
  <br>
- 특정 AI 제공사에 종속되지 않도록 내부적으로 OpenAI, Claude 등 여러 제공자를 설정만으로 바꿔 사용할 수 있게 설계했습니다.
  ![AI 세팅](./.github/assets/09%20ai-setting.png)
  <br>
- 수료증에는 이름 등 개인정보가 포함되므로, AI 제공사 쪽에 데이터가 불필요하게 남지 않도록 신경 썼습니다.
  - **OpenAI**: 요청마다 `store: false`를 명시해, 해당 호출이 모델 개선(distillation)이나 평가 목적으로 저장되지 않도록 합니다.
  - **Claude(Anthropic)**: 구조화된 출력(Structured Outputs) 기능을 사용하여 자동으로 Zero Data Retention(ZDR) 대상이 됩니다.
  - 검증 기준을 담은 JSON 스키마에는 개인정보를 넣지 않고, 필드 이름·설명 같은 구조 정보만 두었습니다.

---

**이 시스템은 이수증을 다음과 같이 관리합니다.**

- **교육 담당자**가 교육을 시스템에 등록합니다.<br>
  ![등록 이미지](./.github/assets/03%20add.gif)
- **각 직원**은 이수하지 않은 교육을 이수한 후 수료증을 업로드합니다.<br>
  ![제출 이미지](./.github/assets/04%20submit.gif)
- **부서·팀 담당자**는 실시간으로 현황을 조회하고, 이수증을 ZIP으로 일괄 다운로드할 수 있습니다.

매 교육마다 수집·취합·보고까지 이어지던 반복 업무를 없애 업무에 더욱 집중할 수 있게 합니다.

---

## 기능 설명

### 👤 일반 직원

본인에게 배정된 교육 목록을 확인하고 이수증을 등록하거나 취소할 수 있습니다.

**이수증 등록 및 취소**

![이수증 삭제](./.github/assets/06%20cancel.gif)

**미이수 교육만 필터링**

아직 이수증을 올리지 않은 교육만 빠르게 골라볼 수 있습니다.

![필터링](./.github/assets/05%20filter.gif)

---

### 🛡️⭐ 팀·부서 담당자

본인의 권한 범위(팀 또는 부서) 안에 있는 직원들의 이수 현황을 조회합니다.
이수자 명단과 이수증 파일을 ZIP으로 일괄 다운로드할 수 있습니다.

**이수 현황 조회**

![이수 현황](./.github/assets/07%20current.gif)

**이수자 명단 및 이수증 ZIP 다운로드**

---

### 📚 교육 담당자

교육을 직접 등록하고 관리합니다.
본인이 등록한 교육에 한해서는 관리자 권한(이수 현황 조회, 이수증 다운로드 등)이 부여되며, 그 외 교육에 대해서는 일반 직원과 동일하게 사용합니다.

**교육 등록**

![교육 등록](./.github/assets/03%20add.gif)

**등록한 교육 관리**

![교육 관리](./.github/assets/08%20delete.gif)

---

### 👑 총괄 관리자

시스템 전반을 관리합니다.

**직원 관리 (CRUD)**

직원 계정을 생성·조회·수정·삭제합니다.

![직원 관리](./.github/assets/02%20member.gif)

**설정 화면**

| 항목              | 설명                                                      |
| ----------------- | --------------------------------------------------------- |
| 부서·팀 구조 설정 | 조직도에 맞게 부서와 팀 계층을 구성합니다                 |
| IP 대역 설정      | 접근을 허용할 IP 화이트리스트를 관리합니다                |
| 데이터 초기화     | 교육 이수 데이터를 연도 기준으로 초기화합니다             |
| 부서·팀 초기화    | 조직개편 등으로 부서 정보 초기화가 필요한 경우 실행합니다 |

![팀 등록](./.github/assets/01%20team.gif)

---

## 권한 체계

| 권한           | 할 수 있는 것                                     |
| -------------- | ------------------------------------------------- |
| 👤 일반 직원   | 본인 이수증 등록·취소, 미이수 필터                |
| 🛡️ 팀 담당자   | 팀 내 이수 현황 조회, 명단·이수증 ZIP 다운로드    |
| ⭐ 부서 담당자 | 부서 내 이수 현황 조회, 명단·이수증 ZIP 다운로드  |
| 📚 교육 담당자 | 교육 등록 + 본인 등록 교육에 한해 관리자 권한     |
| 👑 총괄 관리자 | 직원 CRUD, 조직 구조 설정, IP 설정, 데이터 초기화 |

---

## 향후 계획

### 교육대상자 선택

교육담당자가 교육을 개설할 때 부서, 팀, 개인별로 이수 대상을 선택할 수 있게 합니다.

### 자동 백업

데이터베이스와 업로드된 수료증 파일을 주기적으로 자동 백업하는 기능을 추가할 예정입니다. 현재 백업 로직은 구현되어 있으나 일부 버그로 인해 수정 중입니다.

- 설정 화면에서 백업 주기(일/주/월) 및 백업 경로 지정
- 지정된 일정에 따라 자동 백업 실행

### 다중 데이터베이스 지원

초기에는 소규모 팀 단위 운영을 전제로 SQLite를 사용했습니다. 사용 규모가 커질 경우를 대비해 PostgreSQL, MySQL 등 외부 DB로 교체할 수 있도록 ORM(Prisma 등) 기반으로 전환할 예정입니다.

### 인사시스템 미연계 수료증 관리

인사시스템과 자동으로 연계되지 않아 수동으로 제출해야 하는 교육 수료증을 별도로 관리하는 기능을 추가할 예정입니다.

- 자동 연계 대상에서 제외된 교육을 별도 목록으로 등록·관리
- 각 직원별로 담당자에게 수료증을 제출했는지 여부를 체크박스로 표시
- 체크 시 제출 날짜를 자동 저장하여 이력 관리

---

## ⚡ 설치 방법

**[Docker](https://docs.docker.com/get-started/get-docker/)** 가 필요합니다. 설치되어 있지 않다면 링크에서 먼저 설치하세요.

```bash
git clone https://github.com/baenong/gongedu.git
cd gongedu
```

**Windows** — `setup.bat` 더블클릭

**Linux / macOS**

```bash
chmod +x setup.sh
./setup.sh
```

```
setup 실행 순서

[1/4] JWT_SECRET 입력 → backend/.env 자동 생성
[2/4] DB 디렉토리 초기화
[3/4] 프론트엔드 배포 방식 선택 (아래 참고)
[4/4] 컨테이너 실행
```

**프론트엔드 배포 방식**

| 선택     | 방식               | 이런 경우 선택하세요                                                  |
| -------- | ------------------ | --------------------------------------------------------------------- |
| 1 (권장) | 미리 빌드된 이미지 | 소스 수정 없이 그대로 사용하는 경우                                   |
| 1 (권장) | 미리 빌드된 이미지 | 프록시·방화벽 환경에서 Docker 빌드 중 npm 오류가 발생하는 경우        |
| 2        | 직접 빌드          | 소스를 수정·커스터마이징했고, Docker 빌드 시 npm이 정상 동작하는 환경 |

> **주의:** 직접 빌드(2번)는 서버에 npm을 설치하는 것이 아니라 Docker 컨테이너 안에서 npm을 실행합니다.
> 프록시·방화벽으로 컨테이너 내부에서 npm 레지스트리 접근이 차단된 환경이라면 직접 빌드도 동일하게 실패하므로 1번을 선택하세요.

완료 후 브라우저에서 `http://서버IP` 로 접속합니다. (기본 포트: 80)

> **포트를 변경하려면** `docker-compose.yml`의 `"80:80"` 중 앞쪽 숫자를 원하는 포트로 수정하세요.

**컨테이너 관리**

```bash
docker compose down                    # 종료
docker compose logs -f                 # 로그 확인

# 미리 빌드된 이미지로 업데이트
docker compose pull && docker compose up -d

# 직접 빌드로 업데이트 (커스터마이징한 경우)
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

데이터(DB, 수료증 파일)는 `backend/data/`, `backend/uploads/`에 보관되므로 컨테이너를 삭제해도 유지됩니다.

---

### 같은 서버에 다른 프로젝트도 함께 운영하는 경우

한 서버(VM)에 gongedu 외 다른 프로젝트도 함께 띄워서 80번 포트를 gongedu가 독점할 수 없는 경우에만 아래처럼 변경하세요. **단독으로 운영한다면 이 섹션은 건너뛰고 기본 설정 그대로 사용하면 됩니다.**

1. **`docker-compose.yml`에서 포트를 내부 전용으로 변경**합니다. 서버의 다른 nginx(또는 다른 리버스 프록시)가 도메인·경로 기준으로 각 프로젝트에 트래픽을 나눠주도록 합니다.

   ```yaml
   frontend:
     ports:
       - "127.0.0.1:8081:80" # 예시. 원하는 내부 포트로 변경
   ```

2. **`frontend/nginx.conf`에서 클라이언트 IP 전달 방식을 수정**합니다. gongedu는 총괄관리자(`geadmin`) 로컬 전용 로그인 제한과 IP 대역 화이트리스트 기능이 실제 접속자 IP에 의존합니다. 앞단에 nginx가 하나 더 있으면 컨테이너 nginx 입장에선 접속자가 항상 앞단 nginx로 보이므로, 아래처럼 앞단이 전달한 IP를 그대로 이어받도록 고쳐야 합니다. 그렇지 않으면 두 기능 모두 무력화됩니다.

   ```nginx
   location /api/ {
       proxy_pass http://backend:8180/api/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

   소스를 수정했으므로 반드시 **직접 빌드 방식**으로 배포해야 합니다.

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
   ```

3. **서버의 앞단 nginx(또는 다른 리버스 프록시)**가 위에서 지정한 내부 포트(예: 8081)로 요청을 넘기도록 설정합니다. 이때 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`처럼 원본 클라이언트 IP를 전달하는 헤더를 반드시 넣어주세요 (2번과 짝을 이루는 설정입니다). 구체적인 설정 방식은 운영 환경에 따라 다르므로 각자의 nginx/리버스 프록시 문서를 참고하세요.

---

### Docker 없이 직접 설치하는 경우

Docker 없이 backend는 pm2로, frontend는 nginx 등으로 직접 정적 서빙하는 방식도 가능합니다. 이 경우 최초 설정 시 backend를 pm2로 기동하면서 이름을 `gongedu-backend`로 지정해두세요.

```bash
cd backend && pm2 start src/index.js --name gongedu-backend
```

이후 업데이트는 `update_direct.sh`로 진행합니다 (`git pull` → backend `npm ci` + `pm2 restart` → frontend `npm ci` + 빌드).

```bash
./update_direct.sh
```

---

### 최초 접속 및 계정 설정

서버 실행 후 아래 계정으로 로그인합니다.

| 항목 | 값            |
| ---- | ------------- |
| ID   | `geadmin`     |
| PW   | `GongEdu!234` |

> **⚠️ `geadmin` 계정은 서버 localhost에서만 로그인할 수 있습니다.**
> 보안상 외부에서의 접근이 차단되어 있습니다.

**서버에 직접 접근 가능한 경우** — 서버에서 브라우저로 `http://localhost` 접속 후 로그인합니다.

**PuTTY 등 SSH로 원격 접속하는 경우** — SSH 로컬 포트 포워딩을 설정하면 관리자 PC의 브라우저에서 접속할 수 있습니다.

PuTTY 접속 설정에서 SSH 연결 전에 아래와 같이 설정합니다.

```
Connection > SSH > Tunnels

Source port : 8080
Destination : localhost:80
○ Local 선택 후 [Add]
```

설정 후 평소처럼 SSH 접속하고, 관리자 PC 브라우저에서 `http://localhost:8080`으로 접속합니다.
PuTTY 창은 SSH 연결 유지를 위해 열어 두어야 합니다.

---

로그인 후 **직원 관리** 메뉴에서 `총괄담당` 권한의 운영 계정을 생성하세요.
이후 일상적인 관리는 해당 계정으로 하며, 접속은 실제 서버 IP(`http://서버IP`)로 합니다.

> **⚠️ `geadmin` 초기 비밀번호는 소스코드에 공개되어 있으므로 반드시 변경하세요.**

---

## 커스터마이징

> 소스를 수정한 경우 **직접 빌드** 방식으로 실행해야 합니다.
>
> ```bash
> docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
> ```

### 외부 도메인에서 API 호출 (CORS)

프론트엔드는 항상 nginx(운영) 또는 vite 프록시(개발)를 통해 API와 같은 origin으로 통신하므로, 기본적으로 다른 origin의 브라우저 요청은 차단됩니다.
별도 도메인(예: 다른 서버의 관리용 대시보드)에서 API를 직접 호출해야 하는 경우에만 `backend/.env`에 아래처럼 추가하세요.

```
CORS_ORIGIN=https://example.com,https://admin.example.com
```

### 로고 변경

`frontend/public/` 안의 SVG 파일 두 개를 교체하면 됩니다.

| 파일                             | 용도               |
| -------------------------------- | ------------------ |
| `frontend/public/logo.svg`       | 라이트 모드용 로고 |
| `frontend/public/logo-white.svg` | 다크 모드용 로고   |

교체 후 위의 직접 빌드 명령으로 컨테이너를 재빌드하면 반영됩니다.

---

## 기술 스택

| 구분     | 기술                                                |
| -------- | --------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS v4       |
| Backend  | Node.js, Express v5, better-sqlite3                 |
| 인증     | JWT, bcryptjs, IP 화이트리스트                      |
| 기타     | archiver (ZIP 생성), exceljs (엑셀 내보내기), nginx |

---

## 트러블슈팅

### Docker 빌드 중 `npm ci` 실패 (사내망 프록시 환경)

사내 프록시 환경에서 `docker compose up --build` 실행 시 npm 패키지 다운로드에 실패하는 경우가 있습니다.

**증상**

```
npm error code ECONNREFUSED
npm error errno ECONNREFUSED
```

**원인**

Docker 빌드 컨텍스트는 호스트의 프록시 설정을 자동으로 상속하지 않아, 컨테이너 내부에서 외부 npm 레지스트리에 접근하지 못합니다.

**해결 방법**

`docker-compose.yml`의 각 서비스에 `build.args`로 프록시를 전달합니다.

```yaml
services:
  backend:
    build:
      context: ./backend
      args:
        - HTTP_PROXY=http://프록시주소:포트
        - HTTPS_PROXY=http://프록시주소:포트
        - NO_PROXY=localhost,127.0.0.1

  frontend:
    build:
      context: ./frontend
      args:
        - HTTP_PROXY=http://프록시주소:포트
        - HTTPS_PROXY=http://프록시주소:포트
        - NO_PROXY=localhost,127.0.0.1
```

또는 빌드 시 `--build-arg`로 직접 전달할 수 있습니다.

```bash
docker compose build \
  --build-arg HTTP_PROXY=http://프록시주소:포트 \
  --build-arg HTTPS_PROXY=http://프록시주소:포트
```

---

## 라이선스

[MIT License](./LICENSE)

---

> 버전 히스토리는 [CHANGELOG.md](./CHANGELOG.md)를 참고하세요.
