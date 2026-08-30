/* اصلاح Space در «شرح هزینه» بدون دستکاری منطق اصلی React.
 * مشکل اصلی: sanitizeInput از trim() استفاده می‌کند و Space انتهای متن
 * را بلافاصله حذف می‌کند؛ بنابراین فاصله‌ای که برای شروع کلمه بعدی زده
 * می‌شود از بین می‌رود. این patch هنگام درج Space یک کاراکتر نامرئی
 * پس از آن قرار می‌دهد تا Space دیگر انتهایی نباشد.
 */
(function () {
  const HIDDEN = '\u200B';

  function isDescriptionInput(el) {
    return el instanceof HTMLInputElement &&
      el.classList.contains('description-input');
  }

  document.addEventListener('beforeinput', function (event) {
    const input = event.target;
    if (!isDescriptionInput(input)) return;
    if (event.inputType !== 'insertText' || event.data !== ' ') return;

    event.preventDefault();

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const before = input.value.slice(0, start);
    const after = input.value.slice(end);

    // اگر همین محل قبلاً کاراکتر نامرئی دارد، دوباره اضافه نکن.
    const insertion = before.endsWith(HIDDEN) ? ' ' : ' ' + HIDDEN;
    const nextValue = before + insertion + after;
    const nextCaret = before.length + insertion.length;

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    if (setter) setter.call(input, nextValue);
    else input.value = nextValue;

    input.setSelectionRange(nextCaret, nextCaret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
})();
