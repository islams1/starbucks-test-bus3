# اختبار ستاربكس — SYRA-EDU-BUS-03

لعبة تعليمية ثلاثية الأبعاد (ويب) لطلاب MBA/MPA مبنية على `Situation5_Starbucks_MarketingStrategy_AR.docx`.

## التشغيل محليًا
```
cd game
python tools/devserver.py 8777      # أو أي خادم ملفات ثابتة
```
ثم افتح `http://127.0.0.1:8777/` (Chrome / Edge، يُفضّل كارت شاشة منفصل وسماعات).

روابط الاختبار السريع (للمطوّر فقط):
- `?dev=lobby` · `?dev=office` · `?dev=meeting` — القفز لمشهد.
- `?dev=meeting&preset=good` — الاجتماع بحالة لاعب أنجز المكتب بشكل سليم (مسار E1).

## النشر (Vercel)
المجلد `game/` موقع ثابت بالكامل. `.vercelignore` يستبعد `_src/` (ملفات المصدر الخام ~1GB) و`tools/`.
حجم الأصول المنشورة ≈ 130MB.

## البنية
| المسار | المحتوى |
|---|---|
| `data/lines.ar.json` | كل الحوار العربي (`src: doc` حرفي من الملف، `src: adapted` يحتاج مراجعة لغوية) + صوت كل شخصية |
| `assets/vo/ar/` | التسجيلات الصوتية (Microsoft neural TTS) + توقيت كل كلمة للشفاه والترجمة |
| `js/story/flow.js` | تسلسل المشاهد S1→S8 |
| `js/story/state.js` | متغيرات الحالة والأدلة M1–M10 ومنطق النهايات E1–E4 |
| `js/story/endings.js` | الخطط الأربع، التوتر، بطاقة يناير ومؤشر السوق، المراجعة الختامية |
| `js/ui/docs.js` | الوثائق والمهام المالية |
| `js/actors/character.js` | الشخصيات: أنيميشن mocap، visemes، رمش، نظر |
| `js/world/*` | المبنى، المدينة، الإضاءة، مشهد مكالمة الفيديو |
| `tools/` | تنزيل الأصول، خبز الأنيميشن، توليد الصوت، اختبارات آلية (Playwright) |

## إعادة توليد الأصوات بعد تعديل النص
```
pip install edge-tts
python -I tools/gen_voice.py ar        # يولّد فقط السطور التي تغيّر نصها
```

## ماذا استخدمنا في كل جزء

| الجزء | الأداة / المصدر | الترخيص | ملاحظات |
|---|---|---|---|
| المحرك ثلاثي الأبعاد | [three.js](https://threejs.org) r160 (WebGL2) | MIT | بدون build؛ ES modules + importmap |
| المبنى والمكاتب والقاعات | مبني بالكود (`js/world/building.js`) | — | جدران/أسقف/عروق/زجاج بالكود، وخامات PBR حقيقية |
| الخامات (طوب، خشب، رخام، أسفلت، بلاط) | [Poly Haven](https://polyhaven.com) + خامة الطوب والخشب من ديمو `demo/` | CC0 | brick_wall_005، wood_floor_deck، walnut_veneer، concrete_pavers… |
| الأثاث والإكسسوارات | Poly Haven (مكتب، كراسي لوبي، لمبات صناعية، براويز، طفاية، نباتات، كيك…) + كراسي الاجتماعات والترابيزات بالكود | CC0 | |
| الأشجار والشجيرات | Poly Haven (island_tree_02، shrub_02) — مخففة بسكربت `tools/thin_tree.py` | CC0 | حركة الهواء بشيدر (vertex shader) |
| السماء والإضاءة | HDRI من Poly Haven (kloofendal_38d_partly_cloudy_puresky) + شمس بزاوية صباح نوفمبر | CC0 | تكيّف العين داخل/خارج، GTAO، Bloom، Color grading |
| المدينة والطريق والعربيات والمحلات | بالكود (`js/world/city.js`، `traffic.js`) | — | عربيات إجرائية بطلاء clear-coat، إشارات مرور، مشاة |
| ورق الشجر المتطاير | بالكود (`js/world/leaves.js`) — InstancedMesh | — | |
| الشخصيات (14 + 4 للشارع) | [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) — النسخ facial | MIT | 175 blendshape (15 viseme + ARKit) — نستخدم 31 |
| الحركة (المشي، الجري، الجلوس، الكلام، المشاعر، التليفون، القهوة، العرض…) | مكتبة Rocketbox Animations (Motion Capture) | MIT | 99 حركة مخبوزة إلى ملف ثنائي مضغوط (`tools/bake_anims.html`) |
| الأيدي على المكتب | IK بالكود (`js/actors/deskhands.js`) | — | الكتف والكوع يتحسبوا عشان الإيد توصل للحاجة |
| تعبيرات الوش والرمش والنظر والنَفَس | بالكود (`js/actors/character.js`) | — | مشاعر لكل جملة + حركة راس/حواجب من الصوت |
| الكلام (الأصوات) | [edge-tts](https://github.com/rany2/edge-tts) — أصوات Microsoft العربية العصبية | أداة MIT؛ الخدمة غير رسمية | للعرض الداخلي؛ للنشر الرسمي يُفضّل Azure Speech أو ممثلين |
| مزامنة الشفايف | توقيت الكلمات من edge-tts + تحويل الحروف العربية لـ visemes + قوة الصوت | — | |
| الأصوات المحيطة والمؤثرات | Web Audio بالكود (نويز مفلتر: مدينة، تكييف، كيبورد، خطوات، مكينة قهوة، نفس، كلاكس) | — | |
| مسارات الشخصيات | A* على شبكة 25 سم (`js/world/nav.js`) | — | يلفوا حوالين الأثاث ويعدّوا من الأبواب |
| الخطوط | IBM Plex Sans Arabic، Noto Naskh Arabic، Inter (Google Fonts) | OFL | |
| الاختبار الآلي | Playwright + Microsoft Edge (`tools/drive.py`) | Apache-2.0 | |
| الاستضافة | Vercel | — | https://third-place-bus3.vercel.app |

## المصادر والتراخيص
- الشخصيات والأنيميشن: Microsoft Rocketbox (MIT) — https://github.com/microsoft/Microsoft-Rocketbox
- الأثاث والأشجار والخامات والسماء: Poly Haven (CC0)
- مكتبة 3D: three.js r160 (MIT)
- الشعار في اللعبة رمز فنجان عام؛ لا يُستخدم شعار العلامة الحقيقي. مؤشر السوق "محاكاة تعليمية" ببيانات خيالية.
