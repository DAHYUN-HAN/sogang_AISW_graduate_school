# GCP 도메인 HTTPS 적용

WP1/WP9 운영 설정. 현재 `/opt/aisw-app`에서 실행 중인 IP HTTPS 배포에 도메인을 추가한다.

## 적용 결과와 영구 설정 위치

| 항목 | 적용 후 |
| --- | --- |
| 기본 웹 주소 | `https://www.aisw-campus.com` |
| API 주소 | `https://www.aisw-campus.com/api` |
| `http://www.aisw-campus.com` | 동일한 경로와 쿼리를 유지해 기본 HTTPS 주소로 308 이동 |
| `http://aisw-campus.com`, `https://aisw-campus.com` | 동일한 경로와 쿼리를 유지해 www HTTPS 주소로 308 이동 |
| 기존 IP HTTPS | 기존 앱을 위해 계속 제공 |
| 인증서 | www와 루트 도메인을 함께 포함, 기존 IP 인증서 별도 유지 |

- `deploy/public-domain.env`: Git에 저장하는 공개 도메인 설정 3개.
- `docker-compose.domain.yml`, `deploy/nginx/domain.conf.template`: HTTPS 및 리디렉션 설정.
- `scripts/production-domain.sh`: 설정 병합, 인증서 발급, 배포, 갱신, 점검의 실행 진입점.
- 서버의 `.env.production`: 기존 DB·로그인·SMTP 비밀 값을 그대로 두고 공개 URL, 허용 Host, CORS만 갱신한다. 이 파일과 최초 변경 전 `.env.production.before-domain` 백업은 Git에서 제외한다.

`Configure`는 같은 설정으로 여러 번 실행해도 결과가 동일하다. `Issue`는 최초 실제 인증서 발급에 사용한다. 이후 인증서는 `certificate-renewer`가 12시간마다 갱신 여부를 확인하고, Nginx는 최대 300초 안에 인증서 변경을 감지해 다시 읽는다. 도메인과 IP 인증서는 각 인증서에 저장된 갱신 설정을 따른다. 설정은 재부팅·재배포 후에도 유지된다.

## 1. 로컬 변경을 Git으로 올리기

변경 파일을 검토한 뒤 평소 사용하는 브랜치에 커밋하고 push한다. `.env.production`, `.env.production.worker`, 인증서, 백업 파일은 올리지 않는다. 공개 설정 파일인 `deploy/public-domain.env`는 포함한다.

## 2. 서버에서 코드 받기

GCP VM SSH에서 실행한다. 현재 배포 브랜치와 로컬에서 push한 브랜치가 같아야 한다.

```bash
cd /opt/aisw-app
git status --short --branch
git pull --ff-only
```

서버에 추적 파일 수정이 남아 있거나 fast-forward가 거부되면 그 내용을 먼저 해결한다. 서버의 실제 환경 파일을 예제 파일로 덮어쓰지 않는다.

## 3. 현재 VM IP와 가비아 DNS 확인

```bash
curl --fail --silent --show-error -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip
getent ahostsv4 aisw-campus.com
getent ahostsv4 www.aisw-campus.com
```

VM 실제 외부 IP, 서버 `.env.production`의 `PUBLIC_IP`, 가비아 `@`와 `www` A 레코드가 같아야 한다. 현재 입력한 DNS 값은 `34.50.35.119`, TTL은 `600`이다. GCP에서 외부 IP를 **고정 IP로 예약**하면 VM 중지 후 재시작에 따른 주소 변경을 방지할 수 있다. 방화벽은 TCP 80과 443 접근을 허용해야 한다.

IP가 달라졌다면 DNS와 `PUBLIC_IP`부터 수정한다. 이 배포는 기존 IP 인증서가 유효한 현재 VM을 전제로 한다. IP까지 바뀐 경우 새 IP 인증서를 준비하고 기존 앱의 IP API 주소도 점검해야 하므로, 다음 발급 단계로 진행하기 전에 변경을 해결한다. 발급 명령은 실제 VM IP 및 도메인 HTTP-01 경로를 확인하고 일치하지 않으면 중단한다.

## 4. 공개 설정 반영 및 검증

```bash
bash scripts/production-domain.sh Configure
bash scripts/production-domain.sh Config
```

`Configure`가 기존 환경 파일에 도메인 값을 영구 저장하고 최초 백업을 만든다. Python 3가 필요하다. `Config`는 Compose 설정과 실제 백엔드 운영 설정을 검증하며 백엔드 이미지를 빌드한다. 실행 중인 컨테이너의 설정은 아직 바뀌지 않는다.

## 5. 인증서 테스트 및 실제 발급

```bash
bash scripts/production-domain.sh IssueStaging
bash scripts/production-domain.sh Issue
```

두 명령을 순서대로 실행한다. 테스트 인증서는 별도 staging 볼륨에 저장되므로 브라우저에서 사용하지 않는다. 실제 인증서는 기존 `aisw-production_letsencrypt` 볼륨 안의 `live/aisw-campus.com/`에 저장된다. 운영 환경에 별도 인증서 볼륨 이름을 설정했다면 그 기존 값을 그대로 사용한다.

현재 실행 중인 Nginx가 HTTP 인증 경로를 계속 제공하므로 www HTTPS를 켜기 전에 인증서를 준비할 수 있다. DNS가 전파되지 않았거나 외부 IP가 다르면 발급을 중단한다. 오류가 발생하면 같은 명령을 계속 반복하지 말고 오류에 나온 DNS/방화벽/인증 경로를 해결한다.

## 6. 재빌드하고 적용

```bash
bash scripts/production-domain.sh Up
bash scripts/production-domain.sh RenewDryRun
bash scripts/production-domain.sh Ps
```

`Up`은 웹을 www API 주소로 재빌드하고, 백엔드·웹·Nginx·갱신 서비스를 새 설정으로 재생성한다. 컨테이너 재생성 중에는 잠깐 접속이 끊길 수 있다. 기존 DB·업로드·인증서 볼륨을 계속 사용한다. 완료 시 IP HTTPS, www HTTPS, 루트 도메인 리디렉션을 자동 확인한다. `RenewDryRun`은 실제 인증서를 교체하지 않고 IP와 도메인 인증서의 갱신 경로를 시험한다.

브라우저에서 아래 두 주소를 확인한다.

- `https://www.aisw-campus.com`: 사이트가 열리고 인증서 경고가 없어야 한다.
- `https://aisw-campus.com/legal/privacy?check=1`: www 주소로 이동하면서 경로와 쿼리가 유지되어야 한다.

## 이후 배포 및 앱 빌드

코드를 받은 뒤에도 `production-domain.sh`를 사용한다. 도메인 설정을 변경했다면 `Configure`, `Config`를 다시 실행하고, 인증서 대상이 달라졌다면 `Issue` 후 `Up`을 실행한다. 일반 코드 배포는 `Up`으로 재빌드한다. 점검은 `Smoke`, 로그는 `Logs`, 수동 갱신은 `Renew`이다.

웹 빌드는 서버 `.env.production`에서 새 주소를 읽는다. 향후 Android/iOS 빌드는 `frontend/.env.production.example`의 www URL을 기존 로컬 `frontend/.env.production` 또는 EAS production 환경의 `EXPO_PUBLIC_*` URL 값에 반영해야 한다. 예제 파일만 수정했다고 기존 로컬 파일이나 EAS 원격 값이 자동으로 바뀌지는 않는다. 이미 설치된 앱의 주소도 자동 변경되지 않으므로 기존 IP HTTPS를 유지한다. Expo Go의 로컬 API 주소는 이 운영 도메인 적용과 별도로 관리한다.

## 초기 전환 되돌리기

처음 생성된 백업과 기존 IP 인증서가 유효할 때만 사용한다. 이후 다른 운영 설정을 변경했다면 최초 백업으로 되돌리기 전에 그 변경을 별도로 보존해야 한다.

```bash
cp .env.production.before-domain .env.production
chmod 600 .env.production
bash scripts/production-ip.sh Config
bash scripts/production-ip.sh Up
```

이 명령은 최초 IP 설정으로 돌아간다. 도메인 인증서 볼륨을 삭제할 필요는 없다. 전환 과정에서 `docker compose down -v`는 사용하지 않는다.
