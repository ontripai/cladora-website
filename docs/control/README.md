# CLADORA current controlled baseline

برنامه اجرایی مصوب چهار ورک در نسخه 1.4، همراه موتور مستقل ارزش‌گذاری AIRPROP و طراحی کنترل چرخه اجرای پروژه PM-01.

## Start here

- [برنامه کامل فارسی v1.4](../roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.md)
- [نسخه Word همان برنامه](../roadmap/CLADORA-EXECUTION-PLAN-FA-v1.4.docx)
- [فهرست وضعیت جاری و Gateهای Runtime](current-baseline.json)
- [Tracker موجود برنامه؛ نمایش ردیف‌ها و ستون «قابل خودکارسازی»](programme-tracker/register.csv) — [همان دادهٔ ماشین‌خوان](programme-tracker/register.json)
- [ماتریس هماهنگی جاری v1.4](WORKSTREAM-COORDINATION-MATRIX-v1.4.md)
- [snapshot تاریخی v1.3](WORKSTREAM-COORDINATION-MATRIX-v1.3.md)
- [ماتریس تاریخی v1.0](WORKSTREAM-COORDINATION-MATRIX-v1.0.md)
- [چرخه شروع و اتمام و اصلاح](PM-01-WORK-LIFECYCLE-v1.0.md)
- [قرارداد رجیستری نظارت خصوصی PM01-A](PM-01-PRIVATE-OVERSIGHT-REGISTRY-v1.0.md)
- [فهرست آمادگی runtime در PM01-B](PM-01-RUNTIME-READINESS-INVENTORY-v1.0.md)
- [دروازه مجوز Runtime پس از PM01-B](PM-01-RUNTIME-AUTHORIZATION-GATE-v1.0.md)
- [مرجع UX و UI و CSS](UX-UI-CSS-REGISTRY-v1.0.md)
- [فهرست مادر موجود](../CLADORA-CONTROLLED-DOCUMENTATION-MASTER-INDEX-v1.0.md)
- [الزامات موبایل مالک و ساکن و ماتریس مسیرها — الحاقیهٔ محلی ۲۰ اکتبر](../roadmap/CLADORA-CORE-V14-WORK-PACKAGE-STATUS-v1.0.md#owner-and-resident-mobile-readiness--2026-10-20-addendum)

## Task routing

| Work | Start task | Plan sections |
| --- | --- | --- |
| CLADORA 12 | V14 CORE 01 and PM01 design | 14, 26–30 |
| AIRPROP CLADORA 02 | V14 AIRPROP 01 and AP-VAL-01A | 16, 20–26 |
| SERVICE CLADORA 02 | V14 SERVICE 01 | 15, 26, 30 |
| CLADORA Community & Experience 01 | V14 CE 01 | 10–11, 17, 26, 30; full 122-feature appendix |

هر ورک baseline جاری را با commit دقیق ثبت و فقط دامنه خود را اجرا کند. هیچ دانسته محلی، آزمون اجرا‌نشده یا status گزارش‌شده به واقعیت جاری Production تبدیل نمی‌شود. قراردادهای چهار ورک ادغام شده‌اند، اما Runtime و Release تا عبور از Gateهای ثبت‌شده در ماتریس v1.4 پذیرفته نیستند.

## Next isolated implementation

بستهٔ [SV-REQUEST-PROVIDER-V2-01](../roadmap/CLADORA-SERVICE-REQUEST-PROVIDER-V2-01-EXECUTION-PACKAGE-v1.0.md) تحویل بعدی SERVICE است؛ Core بازبینی قرارداد و مرز authority را انجام می‌دهد. Documents & PM مالک هماهنگی و ادغام است؛ Documents & Vault مالک provider محصول اسناد است. این دو ورک یکی نیستند.

## Change control

GitHub owns code, documents and PR evidence. The proposed PM database owns execution cycles and acceptance records when implemented. GitHub Issues/Projects may mirror those records; they must not become a competing status authority. A merged PR or passing CI does not automatically close a work package.

This is a documentation baseline. No PM database, connector, valuation model, permission, migration, workflow or deployment is installed by these files. Existing operation-specific authorizations remain separate. All runtime implementation must reuse existing CLADORA authority/audit/outbox where applicable.

## جهت‌گیری خودکارسازی — v1.0.0، 2026-11-02

شناسه: `CLADORA-AUTOMATION-DIRECTION`. هدف، حرکت تدریجی از ابزار ثبت و پیگیری به دریافت و کنترل اطلاعات، پیشبرد کار و ارجاع تصمیم‌ها و استثناها به مسئول انسانی است. این افزوده، اولویت، دامنه، Parent SHA، شاخه، ترتیب یا معیار پذیرش بسته‌های فعال و برنامهٔ v1.4 را تغییر نمی‌دهد. پیاده‌سازی AI، اتصال تجهیز، خرید سرویس یا تغییر زیرساخت مجاز نشده است.

Tracker با همان شناسهٔ موجود `CLADORA-PROGRAM-REMAINING-AND-DEPENDENCIES-01` و همان ۱۷۰ ردیف حفظ شده است؛ JSON نسخهٔ قابل‌انتقال همان ثبت و CSV نمایش آن است، نه رجیستری یا موتور گزارش موازی. این ۱۷۰ ردیف شامل ۴۸ بسته و ۱۲۲ زیرردیف قابلیت‌اند؛ همگی فرایند مستقل یا تسک باز جدید نیستند. فیلدهای وضعیت و گیت‌های پایه و زمان مشاهدهٔ قبلی حفظ شده‌اند؛ شواهد و دلتاهای پذیرش جاری همچنان جداگانه در #463 مصرف می‌شوند و طبقه‌بندی خودکارسازی جای آن‌ها را نمی‌گیرد.

ستون «قابل خودکارسازی» فقط یکی از این مقادیر را می‌پذیرد: «خودکارسازی موجود»، «قابل خودکارسازی»، «ترکیبی؛ اجرا با تأیید انسانی»، «نیازمند تصمیم انسانی»، «نیازمند بررسی». مقدار نامعلوم «نیازمند بررسی» است. «خودکارسازی موجود» به پیاده‌سازی و شواهد واقعی قابل‌ارجاع نیاز دارد؛ وجود کد، قرارداد یا آزمون مصنوعی به‌تنهایی پذیرش یا اختیار runtime ایجاد نمی‌کند. هیچ ردیفی در این ثبت «خودکارسازی موجود» اعلام نشده است. CE010 به‌عنوان فرصت طراحی ترکیبی و CE012 با شکاف writer جاری، بدون مجوز خودکارسازی ثبت شده‌اند.

فقط هنگام بررسی عادی همان فرایند، در رکورد موجود آن هفت مورد کوتاه تکمیل شوند: ورودی؛ بخش قابل خودکارسازی؛ تصمیم انسانی و نقش آن؛ شرایط اجرا؛ استثنا و مسئول ارجاع؛ وابستگی رسمی؛ معیار ارزش. در این افزوده فقط CE010 و CE012 که در حال بررسی بودند توضیح دارند؛ مرور گستردهٔ تاریخچه لازم نیست. مالک هر ورک فقط رکوردهای خودش را به‌روزرسانی کند و در گزارش معمول یک جملهٔ فرصت/وابستگی بیاورد؛ coordinator همان دلتا را در Tracker تطبیق می‌دهد. بسته‌های صرفاً CSS/focus/build فرایند عملیاتی ساختگی نسازند. توسعه برای تکمیل متادیتای تاریخی متوقف نشود.

قواعد توسعهٔ جاری:

- منطق عملیات در مسیر رسمی و قابل‌استفادهٔ مجدد سرور بماند؛ UI، تجهیز یا اتوماسیون آینده همان قرارداد را مصرف کنند؛ موتور موازی ساخته نشود.
- AI فقط می‌تواند استخراج، طبقه‌بندی و پیشنهاد کند؛ محاسبات مالی، مجوز و قواعد ثبت قطعی باشند.
- اقدام خودکار همان کنترل اختیار، scope، revoke، expiry و idempotency اقدام انسانی را رعایت کند؛ اختیار جاری پس از انتظار نیز معتبر بماند.
- اختیار اجرا صریح، محدود، قابل‌لغو و قابل‌ردیابی باشد. ستون Tracker یا خروجی مدل، اختیار ایجاد نمی‌کند.
- تأیید انسانی به نسخهٔ دقیق اطلاعات و اقدام متصل باشد؛ تغییر مؤثر نیازمند ارزیابی مجدد تأیید است.
- نتیجهٔ نامشخص و retry نباید ثبت، پرداخت، پیام یا دستورکار تکراری بسازند؛ قواعد فعلی UNKNOWN/pending/replay تضعیف نشوند.
- منبع، اصلاح انسانی، تأیید و نتیجه قابل‌ردیابی باشند؛ متن اسناد و ایمیل داده است و اختیار اجرای دستور نمی‌سازد.
- کار خارج از scope فقط پیشنهاد آینده است؛ پذیرش امنیت، صحت و آزمون‌های بستهٔ فعال همچنان طبق قرارداد فعلی آن انجام می‌شود.

صف آینده، فقط به‌ترتیب پیشنهادی؛ هیچ مورد انتخاب، زمان‌بندی، متصل یا فعال نشده است:

| ترتیب پیشنهادی | فرصت | اتصال به موتور موجود | مرز تصمیم/شکاف |
| --- | --- | --- | --- |
| ۱ | دریافت فاکتور، استخراج، کنترل و پیش‌نویس ثبت حسابداری | Documents → Finance/FIN01 | پیش‌نویس از ثبت رسمی/پرداخت جدا؛ قرارداد دریافت و تأیید نیازمند بررسی |
| ۲ | تطبیق تراکنش بانکی و رسیدگی به مغایرت | Finance/FIN01 و Documents | دسترسی مجاز بانک، یکتایی تراکنش و حدود رسیدگی نیازمند بررسی |
| ۳ | قرائت کنتور و کنترل مصرف غیرعادی | Operations/OPS01، Documents و Finance در صورت اثر مالی | کیفیت/واحد/زمان و قرارداد تجهیز نیازمند بررسی؛ اتصال تجهیز درخواست نشده |
| ۴ | نگهداری پیشگیرانه، دستورکار و پیگیری پیمانکار | Operations/OPS01، Documents و Communications/COM01 | حدود اختیار، هزینه، انتخاب پیمانکار و کانال مجاز نیازمند بررسی |
| ۵ | آماده‌سازی شارژ، گزارش و کنترل بستن دوره | Finance/FIN01، Documents و Communications/COM01 | قواعد قطعی تقسیم و دوره؛ تأیید بستن/ثبت با سیاست مالی موجود |
| ۶ | پیگیری مدارک و اطلاعات ناقص راه‌اندازی ساختمان | Documents، مسیر رسمی Operations و Communications/COM01 | مدارک الزامی، مخاطب و سقف یادآوری نیازمند بررسی |

این اتصال‌ها نگاشت مالکیت/قرارداد برای بررسی آینده‌اند؛ وجود adapter، readiness یا proof اتصال از آن‌ها نتیجه نمی‌شود. انتخاب اولین بسته بعداً با توجه به آمادگی، ریسک و ارزش انجام می‌شود. در بستهٔ آینده خط مبنای زمان رسیدگی، نرخ اصلاح و تعداد دخالت انسانی ثبت و سپس با همان تعریف مقایسه شود؛ مقدار فعلی اندازه‌گیری نشده و «نیازمند بررسی» است. سرعت بیشتر همراه با خطا یا کار اصلاحی بیشتر به‌تنهایی موفقیت نیست.

ابلاغ رسمی در #463 با نسخه و لینک Tracker ثبت می‌شود. انتشار در مرجع مشترک، دریافت مستقیم یا ACK همهٔ چت‌های مستقل را اثبات نمی‌کند؛ متن قابل‌کپی برای انتقال در گزارش هماهنگ‌کننده ارائه می‌شود. گزارش عادی هر بسته یک جمله کافی است؛ گزارش موازی ساخته نشود.

Use the pinned commit in the manifest. A later document update requires an explicit change entry and consumer impact review. Historical matrices remain evidence of their observation date and must not be reused as live status.
