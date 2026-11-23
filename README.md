# Feek El Hayah Choir — Website

Pages: Home · About · Concerts & Tickets (seat booking) · Gallery · Videos · Join (auditions) · Contact · Admin
Languages: Arabic + English (switch button in the top menu).

---

## 1. Try it now (demo mode)
1. Unzip the folder anywhere on your laptop.
2. Double-click **index.html**. It opens in your browser.
3. Admin page: click **الإدارة / Admin** at the bottom of any page → password **admin123**.

In demo mode everything is saved **in this browser only**, so it's just for testing.
You need an internet connection for fonts, icons and YouTube videos.

## 2. Go live with Supabase (free)
1. Open your Supabase project → **SQL Editor** → **New query**.
   Paste everything from `supabase/schema.sql` → **Run**.
2. **Authentication → Users → Add user**: create the admin login
   (your email + a strong password). Tick "Auto confirm user".
3. **Authentication → Sign In / Providers**: turn **OFF** "Allow new users to sign up".
4. Back in **SQL Editor**, run this (with your email):
   ```sql
   insert into public.admins (user_id, email)
     select id, email from auth.users where email = 'marcomedhat95@gmail.com';
   ```
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key
   into `assets/js/config.js`:
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJ...",
   ```
   ⚠️ Never put the **service_role** key in this file.
6. Open index.html again. The yellow "demo mode" bar disappears, and the admin page now asks for the email + password.

To add another admin later, repeat steps 2 and 4 with their email.

## 3. Put it online later (free)
Drag the whole folder onto **https://app.netlify.com/drop**. You get a link like
`feek-el-hayah.netlify.app`. To update the site, drag the folder again.
Content changes (concerts, photos, bookings…) are made from the Admin page and show live, so there's no need to re-upload for those.

## Admin guide
| Tab | What you do there |
|---|---|
| Concerts | Add / edit / cancel / delete concerts (asks for the admin password). Set the date, venue, payment instructions, poster, **seat plan and prices**, and open or close booking. |
| Bookings | See each booking, open the receipt, change status **pending → confirmed** (or cancelled, which frees the seats). Add cash bookings manually. Export to Excel (CSV). |
| Auditions | Applications with voice recordings. Set status: new / invited / accepted / rejected. Add notes. Export. |
| Messages | Contact-form messages. |
| Gallery | Create an album → **Photos** → select many photos at once (large photos are resized automatically). |
| Videos | Paste YouTube links. The Videos page also shows your channel's latest uploads automatically. |
| Team | Patron, conductor, team members with photos. |
| Settings | About text, contacts, WhatsApp, rehearsal times, Google Map, social links, auditions open/closed. |

### Seat plan format
New concerts start with the **Papal HQ theatre plan** (hall A–R = 346 seats, balcony AA–EE = 72 seats).
Each line is one row, written as seen from the hall (stage on top):
```
A: _ _ _ _ | 15 13 11 9 7 5 3 1 2 4 6 8 10 12 14 | 16 18 20 _ :vip
---                       (walkway between rows)
```
`|` = aisle, `_` = no seat, the last part (`:vip`) = the category code from the prices table.
Simple halls can use the short form `A-E:24:vip` (rows A to E, seats 1–24).
Prices are **placeholders**, so set the real ones per concert.

## Files
```
index.html … admin.html     pages
assets/css/style.css        design (colours at the top)
assets/js/config.js         ← Supabase keys & demo password
assets/js/i18n.js           all Arabic/English interface text
assets/js/data.js           database layer (demo + Supabase)
assets/img/                 logo files
supabase/schema.sql         database setup script
```
