export const SECTION_STORAGE_KEY = 'ltp_selected_section_id';
export const SECTION_CHANGE_EVENT = 'ltp:section-change';

type SectionSelectionDetail = {
  sectionId: string;
};

export function readSelectedSectionId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(SECTION_STORAGE_KEY) ?? '';
}

export function publishSelectedSection(sectionId: string) {
  if (typeof window === 'undefined' || !sectionId) return;

  window.localStorage.setItem(SECTION_STORAGE_KEY, sectionId);
  window.dispatchEvent(
    new CustomEvent<SectionSelectionDetail>(SECTION_CHANGE_EVENT, {
      detail: { sectionId },
    })
  );
}

export function subscribeSelectedSection(
  listener: (sectionId: string) => void
) {
  if (typeof window === 'undefined') return () => undefined;

  const onSelection = (event: Event) => {
    const customEvent = event as CustomEvent<SectionSelectionDetail>;
    const sectionId = customEvent.detail?.sectionId;
    if (sectionId) listener(sectionId);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== SECTION_STORAGE_KEY || !event.newValue) return;
    listener(event.newValue);
  };

  window.addEventListener(SECTION_CHANGE_EVENT, onSelection as EventListener);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(SECTION_CHANGE_EVENT, onSelection as EventListener);
    window.removeEventListener('storage', onStorage);
  };
}
