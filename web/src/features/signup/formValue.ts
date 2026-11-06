/** Keep raw password bytes; callers trim only ordinary text fields. */
export function formValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}
