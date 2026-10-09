# CLADORA current controlled baseline

برنامه اجرایی مصوب چهار ورک در نسخه 1.4، همراه موتور مستقل ارزش‌گذاری AIRPROP و طراحی کنترل چرخه اجرای پروژه PM-01.

## Start here

- [برنامه کامل فارسی v1.4](../roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.md)
- [نسخه Word همان برنامه](../roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.docx)
- [فهرست نسخه‌ها و منابع واقعی](current-baseline.json)
- [ماتریس هماهنگی PRهای فعال](WORKSTREAM-COORDINATION-MATRIX-v1.0.md)
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

هر ورک همین baseline را با commit دقیق ثبت و فقط دامنه خود را اجرا کند. هیچ دانسته محلی، آزمون اجرا‌نشده یا status گزارش‌شده به واقعیت جاری Production تبدیل نمی‌شود. گردش دستی تا آماده‌شدن PM runtime موقتاً ادامه دارد.

## Change control

GitHub owns code, documents and PR evidence. The proposed PM database owns execution cycles and acceptance records when implemented. GitHub Issues/Projects may mirror those records; they must not become a competing status authority. A merged PR or passing CI does not automatically close a work package.

This is a documentation baseline. No PM database, connector, valuation model, permission, migration, workflow or deployment is installed by these files. Existing operation-specific authorizations remain separate. All runtime implementation must reuse existing CLADORA authority/audit/outbox where applicable.

Use the content hashes and pinned commit in the manifest. A later document update requires an explicit change entry and consumer impact review. For this new baseline, the plan is user-approved; repository merge status is separate. Until merge, the exact documentation PR commit is the reference for readers.
