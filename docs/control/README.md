# CLADORA current controlled baseline

برنامه اجرایی مصوب چهار ورک در نسخه 1.4، همراه موتور مستقل ارزش‌گذاری AIRPROP و طراحی کنترل چرخه اجرای پروژه PM-01.

## Start here

- [برنامه کامل فارسی v1.4](../roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.md)
- [نسخه Word همان برنامه](../roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.docx)
- [فهرست نسخه‌ها و منابع واقعی](current-baseline.json)
- [ماتریس هماهنگی جاری PRها (v1.1)](WORKSTREAM-COORDINATION-MATRIX-v1.1.md)
- [ماتریس تاریخی مشاهده ۹ اکتبر (v1.0)](WORKSTREAM-COORDINATION-MATRIX-v1.0.md)
- [چرخه شروع و اتمام و اصلاح](PM-01-WORK-LIFECYCLE-v1.0.md)
- [قرارداد رجیستری نظارت خصوصی PM01-A](PM-01-PRIVATE-OVERSIGHT-REGISTRY-v1.0.md)
- [فهرست آمادگی runtime در PM01-B](PM-01-RUNTIME-READINESS-INVENTORY-v1.0.md)
- [دروازه مجوز Runtime پس از PM01-B](PM-01-RUNTIME-AUTHORIZATION-GATE-v1.0.md)
- [مرجع UX و UI و CSS](UX-UI-CSS-REGISTRY-v1.0.md)
- [فهرست مادر موجود](../CLADORA-CONTROLLED-DOCUMENTATION-MASTER-INDEX-v1.0.md)

## Task routing

| Work | Start task | Plan sections |
| --- | --- | --- |
| CLADORA 12 | V14 CORE 01 and PM01 design | 14, 26–30 |
| AIRPROP CLADORA 02 | V14 AIRPROP 01 and AP-VAL-01A | 16, 20–26 |
| SERVICE CLADORA 02 | V14 SERVICE 01 | 15, 26, 30 |
| CLADORA Community & Experience 01 | V14 CE 01 | 10–11, 17, 26, 30; full 122-feature appendix |

هر ورک همین baseline را با commit دقیق ثبت و فقط دامنه خود را اجرا کند. هیچ دانسته محلی، آزمون اجرا‌نشده یا status گزارش‌شده به واقعیت جاری Production تبدیل نمی‌شود. سامانه گزارش‌دهی و نظارت PM در Production فعال است و هر ورک باید گزارش خود را با credential اختصاصی همان ورک ثبت کند؛ این سامانه از runtime خصوصی `pm_private` در PR #324 مستقل است و فعال‌بودن آن به معنی نصب migration آن PR نیست.

## Change control

GitHub owns code, documents and PR evidence. The proposed PM database owns execution cycles and acceptance records when implemented. GitHub Issues/Projects may mirror those records; they must not become a competing status authority. A merged PR or passing CI does not automatically close a work package.

These files do not install a database, connector, valuation model, permission, migration, workflow or deployment. The separately operated PM reporting control plane is live; the proposed `pm_private` runtime and migration in PR #324 are not installed. Existing operation-specific authorizations remain separate. All runtime implementation must reuse existing CLADORA authority/audit/outbox where applicable.

Use the content hashes and pinned commit in the manifest. A later document update requires an explicit change entry and consumer impact review. The plan and its original documentation packages are merged; live package state is recorded separately in the current coordination matrix. Until a later documentation update is merged, consumers must pin its exact PR commit.
