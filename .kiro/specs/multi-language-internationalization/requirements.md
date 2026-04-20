# Requirements Document

## Introduction

This feature adds a complete multi-language internationalization (i18n) system to the ShopHub e-commerce platform. The application is built with React + TypeScript (frontend) and Python Flask (backend). A currency store (`currencyStore.ts`) and a combined `CurrencySelector` component already exist; the language selection is currently stored in state but no translation layer is wired up — all UI text remains hardcoded in English.

The scope of this feature covers:
1. A translation engine that replaces all hardcoded UI strings with locale-aware equivalents across every page (public, auth, user, seller, admin).
2. Splitting the existing combined Currency+Language selector into two independent, separately-positioned controls in the Navbar.
3. Surfacing a standalone Language Selector on the Login and Signup pages (where the Navbar is absent).
4. Modernising the visual quality of several UI elements that currently use browser-native styling: the number spinner on price inputs, the sort dropdown, and validation error marks.

The 20 languages already defined in `currencyStore.ts` (English, Hindi, Arabic, French, German, Spanish, Portuguese, Chinese, Japanese, Korean, Russian, Turkish, Indonesian, Malay, Thai, Bengali, Urdu, Tamil, Telugu, Marathi) are the supported set. RTL layout for Arabic and Urdu is already handled via `document.documentElement.dir`; this feature must preserve and extend that behaviour.

---

## Glossary

- **I18n_System**: The complete internationalization subsystem, including the translation store, translation files, and the `useTranslation` hook.
- **Translation_Store**: A Zustand store (or extension of `currencyStore`) that holds the active language code and exposes the `t()` translation function.
- **Translation_File**: A JSON file per language (e.g. `en.json`, `hi.json`) containing key-value pairs mapping translation keys to locale strings.
- **Translation_Key**: A dot-notation string (e.g. `nav.search`, `auth.login.title`) that uniquely identifies a UI string.
- **Language_Selector**: A UI component that lists the 20 supported languages and allows the user to switch the active language.
- **Currency_Selector**: The existing UI component that lists the 24 supported currencies; it will be decoupled from the Language_Selector.
- **Navbar**: The sticky top navigation bar rendered by `Navbar.tsx`, present on all non-auth pages.
- **Auth_Pages**: The Login (`LoginPage.tsx`) and Signup (`SignupPage.tsx`) pages, which render without the Navbar.
- **RTL_Language**: A language whose script reads right-to-left; currently Arabic (`ar`) and Urdu (`ur`).
- **Custom_Select**: A fully styled React dropdown component that replaces the browser-native `<select>` element.
- **Spinner_Input**: A numeric input component that hides the browser-native increment/decrement arrows and replaces them with styled `+`/`−` buttons.
- **Validation_Mark**: The inline error indicator shown beneath form fields when validation fails.
- **Page_Scope**: The set of pages that must have all visible text translated: public pages (Home, Products, Product Detail), auth pages (Login, Signup, Forgot Password), user pages (Dashboard, Cart, Checkout, Orders, Addresses, Wishlist, Wallet, Profile), seller pages (Overview, Products, Orders, Coupons, Categories, Messages), admin pages (Dashboard, Categories, Returns, Sellers, Product Directory, Surveillance), and shared modals/components.

---

## Requirements

### Requirement 1: Translation File Infrastructure

**User Story:** As a developer, I want a structured set of translation files and a loading mechanism, so that all UI strings can be maintained in one place per language and loaded at runtime.

#### Acceptance Criteria

1. THE I18n_System SHALL provide one Translation_File per supported language, stored under `frontend/src/i18n/{langCode}.json`.
2. THE I18n_System SHALL include Translation_Files for all 20 language codes defined in `currencyStore.ts`: `en`, `hi`, `ar`, `fr`, `de`, `es`, `pt`, `zh`, `ja`, `ko`, `ru`, `tr`, `id`, `ms`, `th`, `bn`, `ur`, `ta`, `te`, `mr`.
3. THE I18n_System SHALL use a flat dot-notation key schema (e.g. `"nav.search"`, `"auth.login.title"`) consistently across all Translation_Files.
4. THE I18n_System SHALL use the English Translation_File (`en.json`) as the canonical key reference; all other Translation_Files SHALL contain the same set of keys.
5. IF a Translation_Key is missing from the active language's Translation_File, THEN THE I18n_System SHALL fall back to the English value for that key.
6. THE I18n_System SHALL support interpolation placeholders in translation values using the `{{variable}}` syntax (e.g. `"welcome": "Welcome, {{name}}!"`).
7. FOR ALL valid Translation_Files, parsing the JSON then serialising it then parsing again SHALL produce an object equal to the original (round-trip property).

---

### Requirement 2: Translation Hook and Store

**User Story:** As a developer, I want a `useTranslation` hook that returns a `t()` function, so that any component can retrieve translated strings with a single import.

#### Acceptance Criteria

1. THE Translation_Store SHALL expose a `t(key: string, vars?: Record<string, string>): string` function that returns the translated string for the active language.
2. WHEN the active language changes, THE Translation_Store SHALL update the `t()` function reference so that all subscribed components re-render with the new language.
3. THE Translation_Store SHALL persist the active language code to `localStorage` under the key `shophub-currency` (reusing the existing persistence slice) so that the language survives page reloads.
4. WHEN the page loads and a persisted language code exists, THE I18n_System SHALL apply that language immediately before the first render to prevent a flash of untranslated content.
5. THE Translation_Store SHALL be initialised with the `language` value already stored in `currencyStore.ts` so that no duplicate state exists.
6. WHILE an RTL_Language is active, THE I18n_System SHALL set `document.documentElement.dir` to `"rtl"` and `document.documentElement.lang` to the language's locale string.
7. WHILE a non-RTL language is active, THE I18n_System SHALL set `document.documentElement.dir` to `"ltr"`.

---

### Requirement 3: Full-Page Translation Coverage

**User Story:** As a user, I want every visible text string on every page to appear in my selected language, so that I can use the entire application in my preferred language.

#### Acceptance Criteria

1. THE I18n_System SHALL translate all visible static text strings across the full Page_Scope using the `t()` function.
2. THE I18n_System SHALL translate navigation labels, button labels, form labels, placeholder text, error messages, toast notifications, empty-state messages, and section headings.
3. THE I18n_System SHALL NOT translate dynamic data returned from the backend API (e.g. product names, seller names, category names, user-generated content).
4. WHEN the active language changes, THE I18n_System SHALL update all translated strings on the current page without requiring a page reload.
5. THE I18n_System SHALL translate the sort option labels in `ProductsPage` (`"Newest First"`, `"Price: Low → High"`, `"Price: High → Low"`) using Translation_Keys.
6. THE I18n_System SHALL translate all form validation error messages produced by client-side validation logic.
7. THE I18n_System SHALL translate all toast notification messages triggered by user actions (login success, signup success, error messages, etc.).

---

### Requirement 4: Separated Language and Currency Selectors in Navbar

**User Story:** As a user, I want the language selector and currency selector to appear as separate controls on opposite sides of the Navbar, so that I can find and use each one independently.

#### Acceptance Criteria

1. THE Navbar SHALL display the Language_Selector on the left side of the right-actions group and the Currency_Selector on the right side, so that they appear as visually distinct controls.
2. THE Language_Selector in the Navbar SHALL show the active language's flag emoji and language code (e.g. `🇺🇸 EN`) as its trigger label.
3. THE Currency_Selector in the Navbar SHALL show the active currency's flag emoji and currency code (e.g. `🇮🇳 INR`) as its trigger label.
4. THE Language_Selector SHALL open a dropdown panel listing all 20 supported languages with their flag, native name, English name, and an RTL badge where applicable.
5. THE Currency_Selector SHALL open a dropdown panel listing all 24 supported currencies with their flag, code, symbol, and label.
6. WHEN a language is selected from the Language_Selector dropdown, THE Language_Selector SHALL close the panel and apply the new language immediately.
7. WHEN a currency is selected from the Currency_Selector dropdown, THE Currency_Selector SHALL close the panel and apply the new currency immediately.
8. THE Language_Selector and Currency_Selector SHALL each include a search input that filters the list by name or code.
9. IF the user clicks outside an open dropdown panel, THEN THE Language_Selector or Currency_Selector SHALL close the panel.
10. IF the user presses the Escape key while a dropdown panel is open, THEN THE Language_Selector or Currency_Selector SHALL close the panel.

---

### Requirement 5: Language Selector on Auth Pages

**User Story:** As a user visiting the Login or Signup page, I want to select my language before authenticating, so that the form and all labels appear in my preferred language immediately.

#### Acceptance Criteria

1. THE Auth_Pages SHALL display a Language_Selector component in the top-right corner of the page, outside the card container.
2. THE Language_Selector on Auth_Pages SHALL use the same dropdown panel and behaviour as the Navbar Language_Selector.
3. WHEN a language is selected on an Auth_Page, THE I18n_System SHALL immediately translate all visible text on that page without a page reload.
4. THE Language_Selector on Auth_Pages SHALL persist the selected language to `localStorage` so that the Navbar reflects the same language after the user logs in and is redirected.
5. THE Language_Selector on Auth_Pages SHALL be keyboard-accessible and meet WCAG 2.1 AA focus-visibility requirements.

---

### Requirement 6: Modern Sort Dropdown (Custom_Select)

**User Story:** As a user browsing products, I want the sort dropdown to match the modern design of the rest of the UI, so that the page looks visually consistent.

#### Acceptance Criteria

1. THE Custom_Select component SHALL replace the native `<select>` element used for sorting in `ProductsPage`.
2. THE Custom_Select SHALL render a styled trigger button that displays the selected option label and a chevron icon, matching the rounded-xl border style used elsewhere in the page.
3. WHEN the Custom_Select trigger is clicked, THE Custom_Select SHALL open a styled dropdown panel listing all sort options.
4. WHEN an option is selected, THE Custom_Select SHALL close the panel and call the `onChange` handler with the selected value.
5. IF the user clicks outside the Custom_Select panel, THEN THE Custom_Select SHALL close the panel.
6. THE Custom_Select SHALL highlight the currently selected option with the orange accent colour (`bg-orange-50`, `text-orange-600`) consistent with other active states in the application.
7. THE Custom_Select SHALL be keyboard-navigable (arrow keys to move focus, Enter to select, Escape to close).
8. THE Custom_Select SHALL support dark mode using the existing Tailwind dark-mode class pattern.

---

### Requirement 7: Modern Price Input (Spinner_Input)

**User Story:** As a user filtering products by price, I want the price input fields to look modern without the browser-native number spinner arrows, so that the UI feels polished and consistent.

#### Acceptance Criteria

1. THE Spinner_Input component SHALL hide the browser-native increment/decrement arrows on `<input type="number">` elements using CSS (`appearance: none` / `-webkit-appearance: none`).
2. THE Spinner_Input SHALL render styled `−` and `+` buttons flanking the input field to allow step-based increment and decrement.
3. WHEN the `+` button is clicked, THE Spinner_Input SHALL increment the input value by the configured step (default: 1).
4. WHEN the `−` button is clicked, THE Spinner_Input SHALL decrement the input value by the configured step, with a minimum value of 0.
5. THE Spinner_Input SHALL accept direct keyboard input for arbitrary numeric values.
6. THE Spinner_Input SHALL call the `onChange` handler with the updated value after each increment, decrement, or direct input event.
7. THE Spinner_Input SHALL apply the same border, background, and focus-ring styles as the existing `Input` component in `Input.tsx`.
8. THE Spinner_Input SHALL support dark mode using the existing Tailwind dark-mode class pattern.

---

### Requirement 8: Modern Validation Marks

**User Story:** As a user filling in forms, I want validation error indicators to look modern and consistent, so that the UI feels polished across all form pages.

#### Acceptance Criteria

1. THE Input component (`Input.tsx`) SHALL display validation errors as a styled inline message below the field using a red accent colour, a small warning icon, and smooth entry animation.
2. WHEN an error is present, THE Input component SHALL apply a red border (`border-red-400`) and a subtle red focus ring (`ring-red-400/20`) to the input field.
3. THE Input component SHALL NOT use browser-native validation UI (e.g. red outline injected by the browser's `:invalid` pseudo-class).
4. THE Input component SHALL render the error message with a `role="alert"` attribute so that screen readers announce the error.
5. WHEN an error is cleared (the `error` prop becomes `undefined`), THE Input component SHALL remove the red border and error message without a page reload.
6. THE Input component's error styling SHALL be consistent across all pages that use it: Login, Signup, Checkout, Address forms, and seller product forms.

---

### Requirement 9: RTL Layout Support

**User Story:** As a user who selects Arabic or Urdu, I want the entire page layout to mirror correctly for right-to-left reading, so that the application is usable in my language.

#### Acceptance Criteria

1. WHILE an RTL_Language is active, THE I18n_System SHALL set the `dir="rtl"` attribute on `<html>` so that the browser applies RTL layout to all elements.
2. WHILE an RTL_Language is active, THE Navbar SHALL reverse the order of its flex children so that the logo appears on the right and actions appear on the left.
3. WHILE an RTL_Language is active, THE ProductsPage sidebar SHALL appear on the right side of the product grid.
4. WHILE an RTL_Language is active, form inputs with leading icons SHALL position the icon on the right side of the field.
5. WHEN the language changes from an RTL_Language to a non-RTL language, THE I18n_System SHALL restore `dir="ltr"` immediately.
6. THE I18n_System SHALL use CSS logical properties (e.g. `ps-`, `pe-` Tailwind utilities or `padding-inline-start`) where possible to support both LTR and RTL layouts without duplicating styles.

---

### Requirement 10: Language Persistence and Initialisation

**User Story:** As a returning user, I want my language preference to be remembered across sessions, so that I do not have to re-select my language every time I visit the site.

#### Acceptance Criteria

1. THE I18n_System SHALL persist the selected language code to `localStorage` as part of the existing `shophub-currency` persistence slice managed by Zustand.
2. WHEN the application initialises, THE I18n_System SHALL read the persisted language code from `localStorage` and apply it before the first render.
3. IF no persisted language code exists, THEN THE I18n_System SHALL default to `"en"` (English).
4. WHEN the language is changed, THE I18n_System SHALL write the new language code to `localStorage` within the same synchronous call that updates the Zustand store.
5. THE I18n_System SHALL apply the correct `document.documentElement.dir` and `document.documentElement.lang` values on rehydration, consistent with the existing `onRehydrateStorage` callback in `currencyStore.ts`.
