# Implementation Plan: Multi-Language Internationalization

## Overview

Implement a complete i18n layer for ShopHub using a lightweight hand-rolled Zustand store + static JSON files (no external i18n library). The work is split into six sequential epics: (1) translation infrastructure, (2) the `useTranslation` hook and store, (3) new/refactored UI components, (4) wiring translations into every page, (5) Navbar and auth-page selector split, and (6) modern UI replacements. Property-based tests use `fast-check`.

## Tasks

- [ ] 1. Install fast-check and set up Vitest test infrastructure
  - Run `npm install --save-dev fast-check vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom` in `frontend/`
  - Add a `vitest.config.ts` (or extend `vite.config.ts`) with `environment: 'jsdom'` and `setupFiles`
  - Add `"test": "vitest --run"` and `"test:watch": "vitest"` scripts to `frontend/package.json`
  - Create `frontend/src/test/setup.ts` that imports `@testing-library/jest-dom`
  - _Requirements: 1.7 (round-trip property needs a test runner)_

- [ ] 2. Create the English translation file and translation infrastructure
  - [ ] 2.1 Create `frontend/src/i18n/en.json` with the full canonical key set
    - Include all key namespaces from the design: `nav.*`, `auth.*`, `products.*`, `common.*`, `currency.*`, `cart.*`, `checkout.*`, `orders.*`, `wishlist.*`, `profile.*`, `seller.*`, `admin.*`, `errors.*`
    - Cover every visible static string across all pages in scope (public, auth, user, seller, admin)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 2.2 Create the remaining 19 translation files (`hi`, `ar`, `fr`, `de`, `es`, `pt`, `zh`, `ja`, `ko`, `ru`, `tr`, `id`, `ms`, `th`, `bn`, `ur`, `ta`, `te`, `mr`)
    - Each file at `frontend/src/i18n/{langCode}.json` must contain exactly the same keys as `en.json`
    - Provide accurate translations for each language (use the native language for values)
    - Mark RTL languages (`ar`, `ur`) with correct right-to-left translated strings
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 2.3 Write property test — Property 4: JSON round-trip
    - **Property 4: JSON Round-Trip**
    - For any flat string-to-string dictionary, `JSON.parse(JSON.stringify(obj))` deep-equals the original
    - **Validates: Requirements 1.7**

  - [ ]* 2.4 Write parameterised example test — Property 1: Key completeness
    - **Property 1: Translation File Key Completeness**
    - For each of the 19 non-English language files, assert its key set equals `en.json`'s key set exactly
    - **Validates: Requirements 1.3, 1.4**

- [ ] 3. Create `translationStore.ts` and `useTranslation` hook
  - [ ] 3.1 Create `frontend/src/store/translationStore.ts`
    - Implement a Zustand store (no `persist` — language persistence is already in `currencyStore`)
    - State: `translations: Record<string, string>`, `enTranslations: Record<string, string>`, `isLoading: boolean`
    - `loadLanguage(code: LangCode)`: dynamically imports `../i18n/{code}.json` via Vite `import()`; always keeps `enTranslations` loaded as fallback
    - `t(key, vars?)`: looks up `translations[key]` → `enTranslations[key]` → `key` itself; replaces `{{varName}}` tokens with `vars[varName]`
    - Subscribe to `useCurrencyStore` via `useCurrencyStore.subscribe` so language changes auto-reload translations without a React component
    - On store creation, immediately load the language already stored in `currencyStore` to prevent flash of untranslated content
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 1.5, 1.6_

  - [ ] 3.2 Create `frontend/src/hooks/useTranslation.ts`
    - Export `useTranslation()` that returns `{ t }` from `useTranslationStore`
    - _Requirements: 2.1_

  - [ ]* 3.3 Write property test — Property 2: Translation fallback
    - **Property 2: Translation Fallback**
    - For any key in `en.json` and any non-English lang code, calling `t(key)` with that key deleted from the active translations returns the English value
    - Use `fc.constantFrom(...Object.keys(enTranslations))` and `fc.constantFrom(...NON_EN_LANG_CODES)`
    - **Validates: Requirements 1.5**

  - [ ]* 3.4 Write property test — Property 3: Interpolation substitution
    - **Property 3: Interpolation Substitution**
    - For any template string with `{{varName}}` placeholders and a matching `vars` object, `t()` returns a string with no unreplaced `{{...}}` tokens
    - Use `fc.array(fc.string(...))` to generate variable names and values
    - **Validates: Requirements 1.6**

  - [ ]* 3.5 Write property test — Property 5: RTL/LTR direction correctness
    - **Property 5: RTL/LTR Direction Correctness**
    - For any language in `LANGUAGES`, calling `setLanguage(code)` sets `document.documentElement.dir` to `"rtl"` iff `lang.rtl === true`
    - Use `fc.constantFrom(...LANGUAGES)`
    - **Validates: Requirements 2.6, 2.7, 9.1, 9.5, 10.5**

  - [ ]* 3.6 Write property test — Property 6: Language persistence round-trip
    - **Property 6: Language Persistence Round-Trip**
    - For any language code, calling `setLanguage(code)` results in `localStorage['shophub-currency']` containing `state.language === code`
    - Use `fc.constantFrom(...LANGUAGES.map(l => l.code))`
    - **Validates: Requirements 2.3, 10.1, 10.4**

  - [ ]* 3.7 Write property test — Property 7: Language switch reactivity
    - **Property 7: Language Switch Reactivity**
    - For any translation key, after `setLanguage('en')` and then `setLanguage('fr')`, both `t(key)` calls return non-empty strings
    - Use `fc.constantFrom(...Object.keys(enTranslations))`
    - **Validates: Requirements 2.2, 3.4**

- [ ] 4. Checkpoint — translation infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Create `SpinnerInput` component
  - [ ] 5.1 Create `frontend/src/components/ui/SpinnerInput.tsx`
    - Props: `value`, `onChange`, `onBlur?`, `min?` (default 0), `max?`, `step?` (default 1), `placeholder?`, `prefix?` (currency symbol), `className?`
    - Render `[−] [input] [+]` layout using `flex` row
    - Use `type="number"` with Tailwind arbitrary variant `[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none` to hide browser arrows
    - `−` button: decrement by `step`, clamped to `min`; disabled when `value === '' || Number(value) <= (min ?? 0)`
    - `+` button: increment by `step`; disabled when `max` is set and `Number(value) >= max`
    - Match `Input.tsx` border/focus-ring styles (`border-gray-200 dark:border-slate-600 rounded-lg focus:border-orange-400`)
    - Dark mode support
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 5.2 Write property test — Property 8: Spinner arithmetic
    - **Property 8: Spinner Arithmetic**
    - For any `v ≥ 0` and `s > 0`, increment returns `v + s` and decrement returns `max(0, v − s)`
    - Export pure `increment(v, s)` and `decrement(v, s)` helpers from `SpinnerInput.tsx` for direct testing
    - Use `fc.float({ min: 0, max: 10000, noNaN: true })` and `fc.float({ min: 1, max: 100, noNaN: true })`
    - **Validates: Requirements 7.3, 7.4**

- [ ] 6. Create `CustomSelect` component
  - [ ] 6.1 Create `frontend/src/components/ui/CustomSelect.tsx`
    - Props: `options: { value: string; label: string }[]`, `value`, `onChange`, `placeholder?`, `icon?`, `className?`
    - Render a styled trigger button (rounded-xl, matching `border-gray-200 dark:border-slate-700` style from `ProductsPage`)
    - Show selected option label + chevron icon in trigger; chevron rotates 180° when open
    - Dropdown panel: styled option rows, active option highlighted with `bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400`
    - Keyboard navigation: ArrowUp/ArrowDown moves focus, Enter selects, Escape closes
    - Close on outside click (via `useEffect` + `mousedown` listener) and on tab-away (`onBlur`)
    - Dark mode support
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 6.2 Write unit tests for `CustomSelect`
    - Test: clicking trigger opens panel; clicking option calls `onChange` and closes panel
    - Test: Escape key closes panel; clicking outside closes panel
    - Test: active option has orange highlight class
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [ ] 7. Enhance `Input` component with modern validation marks
  - Modify `frontend/src/components/ui/Input.tsx`:
    - Add `AlertCircle` icon (Lucide, size 12) before the error text in the error `<p>` element
    - Add `role="alert"` and `aria-live="polite"` to the error `<p>`
    - Add entry animation classes to the error message: `animate-in slide-in-from-top-1 fade-in duration-150` (requires `tailwindcss-animate` or equivalent; if not available, use a simple `transition-all` approach)
    - Add `[&:invalid]:shadow-none` to the input element to suppress browser-native `:invalid` styling
    - Existing red border (`border-red-400`) and focus ring (`focus:ring-red-400/20`) are already present — verify they remain correct
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 7.1 Write unit tests for `Input` error state
    - Test: `role="alert"` is present when `error` prop is set
    - Test: `AlertCircle` icon renders alongside error text
    - Test: error `<p>` is absent when `error` prop is `undefined`
    - _Requirements: 8.1, 8.3, 8.4, 8.5_

- [ ] 8. Checkpoint — new UI components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Extract `LanguageSelector` and refactor `CurrencySelector`
  - [ ] 9.1 Create `frontend/src/components/ui/LanguageSelector.tsx`
    - Extract the language tab logic from the existing `CurrencySelector.tsx`
    - Props: `compact?: boolean` (auth-page variant — smaller trigger, no code label), `className?: string`
    - Trigger button: shows active language flag + code (e.g. `🇺🇸 EN`); in `compact` mode shows flag + chevron only
    - Dropdown panel: search input + scrollable list of all 20 languages (flag, native name, English name, RTL badge)
    - Close on outside click (`mousedown` listener) and Escape key
    - On selection: call `setLanguage(code)`, close panel
    - Keyboard accessible: `aria-expanded`, `aria-label`, focus-visible rings (WCAG 2.1 AA)
    - _Requirements: 4.2, 4.4, 4.6, 4.8, 4.9, 4.10, 5.2, 5.5_

  - [ ] 9.2 Refactor `frontend/src/components/ui/CurrencySelector.tsx`
    - Remove the Language tab entirely; the component now shows only the currency list
    - Update trigger label to show `{flag} {code}` (e.g. `🇮🇳 INR`) — no language flag
    - Keep search input, outside-click close, Escape close, and all existing currency list behaviour
    - _Requirements: 4.3, 4.5, 4.7, 4.8, 4.9, 4.10_

- [ ] 10. Update `Navbar` to use separated selectors and translations
  - Modify `frontend/src/components/layout/Navbar.tsx`:
    - Replace the single `<CurrencySelector />` with `<LanguageSelector />` followed by `<CurrencySelector />` in the right-actions group (language left of currency per Req 4.1)
    - Import and use `useTranslation` to translate: search placeholder (`nav.search`), nav links (`nav.allProducts`, `nav.categories`, `nav.sellOnShopHub`), login/signup buttons (`nav.login`, `nav.signup`), user dropdown items (`nav.dashboard`, `nav.profile`, `nav.orders`, `nav.wallet`, `nav.logout`), cart aria-label, wishlist aria-label, search clear aria-label
    - Translate the "Instant Results" label, "See all results for" text, and "No results" empty state messages
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3_

- [ ] 11. Add `LanguageSelector` to Login and Signup pages
  - Modify `frontend/src/pages/auth/LoginPage.tsx`:
    - Import `LanguageSelector` and render it `absolute top-4 right-4` (or `top-4 start-4` for RTL) relative to the page container (`relative` on the outer `div`)
    - Pass `compact` prop
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - Modify `frontend/src/pages/auth/SignupPage.tsx`:
    - Same placement and `compact` prop as `LoginPage`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 12. Wire translations into auth pages
  - Modify `frontend/src/pages/auth/LoginPage.tsx`:
    - Use `useTranslation` to translate: page subtitle, card title, field labels (`auth.login.email`, `auth.login.password`), forgot password link, submit button, divider text, sign-up link text
    - Translate validation error messages in `validate()` using `t('auth.validation.*')` keys
    - Translate toast messages: `auth.toast.loginSuccess` (with `{{name}}` interpolation), `auth.toast.loginFailed`
    - _Requirements: 3.1, 3.2, 3.6, 3.7_
  - Modify `frontend/src/pages/auth/SignupPage.tsx`:
    - Use `useTranslation` to translate: page subtitle, card title, role toggle labels, all field labels, submit button, divider, sign-in link
    - Translate validation error messages using `t('auth.validation.*')` keys
    - Translate toast messages: `auth.toast.signupSuccess`, `auth.toast.signupFailed`
    - _Requirements: 3.1, 3.2, 3.6, 3.7_
  - Modify `frontend/src/pages/auth/ForgotPasswordPage.tsx`:
    - Apply `useTranslation` to all visible static strings
    - _Requirements: 3.1, 3.2_

- [ ] 13. Wire translations and new components into `ProductsPage`
  - Modify `frontend/src/pages/public/ProductsPage.tsx`:
    - Replace the native `<select>` sort control with `<CustomSelect options={SORT_OPTIONS_TRANSLATED} ...>` where option labels come from `t('products.sort.*')` keys
    - Replace both `<input type="number">` fields in `PriceRangeFilter` with `<SpinnerInput>` components
    - Use `useTranslation` to translate: page title, results count (`products.found` / `products.foundPlural` with `{{count}}`), sort option labels, all filter labels and placeholders, empty-state messages, "You Might Like" heading, "Instant Results" label, "Clear" buttons, filter chip labels
    - _Requirements: 3.1, 3.2, 3.5, 6.1, 7.1_

- [ ] 14. Wire translations into remaining public and user pages
  - Apply `useTranslation` to all visible static strings in:
    - `frontend/src/pages/public/HomePage.tsx`
    - `frontend/src/pages/public/ProductDetailPage.tsx`
    - `frontend/src/pages/user/CartPage.tsx` — translate cart title, empty state, checkout button, totals labels
    - `frontend/src/pages/user/CheckoutPage.tsx` — translate section headings, button labels
    - `frontend/src/pages/user/OrdersPage.tsx` — translate title, empty state, status labels (`orders.status.*`)
    - `frontend/src/pages/user/AddressesPage.tsx`
    - `frontend/src/pages/user/WishlistPage.tsx` — translate title, empty state, action buttons
    - `frontend/src/pages/user/WalletHistoryPage.tsx`
    - `frontend/src/pages/user/CustomerDashboard.tsx`
    - `frontend/src/pages/user/UserProfilePage.tsx` — translate field labels, save button
    - `frontend/src/pages/shared/ProfilePage.tsx`
  - Add any missing translation keys to `en.json` (and mirror to all 19 other files)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 15. Wire translations into seller and admin pages
  - Apply `useTranslation` to all visible static strings in:
    - `frontend/src/pages/seller/SellerOverviewPage.tsx`
    - `frontend/src/pages/seller/SellerProductsPage.tsx`
    - `frontend/src/pages/seller/SellerOrdersPage.tsx`
    - `frontend/src/pages/seller/SellerCouponsPage.tsx`
    - `frontend/src/pages/seller/SellerCategoriesPage.tsx`
    - `frontend/src/pages/seller/SellerMessagesPage.tsx`
    - `frontend/src/pages/admin/AdminDashboardPage.tsx`
    - `frontend/src/pages/admin/AdminCategoriesPage.tsx`
    - `frontend/src/pages/admin/AdminReturnsPage.tsx`
    - `frontend/src/pages/admin/ManageSellersPage.tsx`
    - `frontend/src/pages/admin/ProductDirectoryPage.tsx`
    - `frontend/src/pages/admin/SellerDetailPage.tsx`
    - `frontend/src/pages/admin/SellerSurveillancePage.tsx`
    - `frontend/src/pages/admin/CategoryRequestsPage.tsx`
  - Apply `useTranslation` to shared modal components:
    - `frontend/src/components/seller/AddProductModal.tsx`
    - `frontend/src/components/seller/QuickEditProductModal.tsx`
    - `frontend/src/components/seller/BuyerProfileModal.tsx`
    - `frontend/src/components/admin/AdminProductQuickViewModal.tsx`
    - `frontend/src/components/admin/SellerKYCModal.tsx`
    - `frontend/src/components/order/ReturnOrderModal.tsx`
    - `frontend/src/components/cart/PromoCodeInput.tsx`
  - Add any missing translation keys to `en.json` and mirror to all 19 other files
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 16. Checkpoint — full translation coverage
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Verify RTL layout correctness
  - [ ] 17.1 Audit and fix RTL layout in `Navbar.tsx`
    - When `isRTL` is true, ensure the flex row reverses correctly (logo right, actions left)
    - Use `dir="rtl"` on the `<header>` element driven by `isRTL` from `useCurrency`, or rely on the `document.documentElement.dir` already set by `currencyStore.setLanguage`
    - _Requirements: 9.1, 9.2_

  - [ ] 17.2 Audit and fix RTL layout in `ProductsPage`
    - Sidebar should appear on the right when RTL is active — the existing `dir={isRTL ? 'rtl' : 'ltr'}` on the page root already handles this via CSS logical properties; verify the sidebar flex order is correct
    - Replace any `pl-`/`pr-` Tailwind classes in the sidebar and filter components with `ps-`/`pe-` logical property equivalents
    - _Requirements: 9.3, 9.6_

  - [ ] 17.3 Audit and fix RTL icon positioning in form inputs
    - In `Input.tsx`, the leading icon uses `left-3`; replace with `start-3` (CSS logical property) so it appears on the correct side in RTL
    - Apply the same fix to any other components with hardcoded `left-`/`right-` positioning for icons
    - _Requirements: 9.4, 9.6_

- [ ] 18. Wire language initialisation before first render
  - Modify `frontend/src/main.tsx` (or the store initialisation):
    - Ensure `translationStore` is imported and initialised before the React tree mounts, so the correct language's JSON is loaded synchronously (or the store's subscribe fires before the first render)
    - Verify the `onRehydrateStorage` callback in `currencyStore` still correctly sets `document.documentElement.dir` and `.lang` on reload
    - _Requirements: 2.4, 10.2, 10.3, 10.5_

- [ ] 19. Final checkpoint — end-to-end wiring
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Property tests use `fast-check` (install in task 1); unit tests use Vitest + Testing Library
- All translation keys must be added to `en.json` first, then mirrored to the other 19 language files
- Dynamic backend data (product names, seller names, category names) must NOT be passed through `t()` — only static UI strings
- RTL support for Arabic (`ar`) and Urdu (`ur`) is already partially wired in `currencyStore.setLanguage`; tasks 17.x extend it to layout
- The `translationStore` does NOT use Zustand `persist` — language code persistence is already handled by `currencyStore`
- `fast-check` properties run a minimum of 100 iterations by default; Property 3 and Property 8 use 200 iterations
