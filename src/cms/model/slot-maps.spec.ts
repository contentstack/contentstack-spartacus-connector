import { PAGE_REFERENCE_FIELDS, SLOT_FIELD_TO_SAP_NAME } from './slot-maps';

describe('PAGE_REFERENCE_FIELDS', () => {
  // Slot discovery has no type restriction -- any slot field can hold a
  // banner component, and a banner's actual image set only resolves through
  // its nested `media_container` reference. Every slot (+ header/footer)
  // needs its own `<slot>.media_container` path or that banner's images
  // round-trip as an unresolved stub, regardless of the referenced
  // media_container entry's own file fields being populated.
  const slotFields = ['header', 'footer', ...Object.keys(SLOT_FIELD_TO_SAP_NAME)];

  it('includes every slot field plus its own media_container nested path', () => {
    for (const field of slotFields) {
      expect(PAGE_REFERENCE_FIELDS).toContain(field);
      expect(PAGE_REFERENCE_FIELDS).toContain(`${field}.media_container`);
    }
  });

  it('has exactly twice as many entries as slot fields (base + nested pair)', () => {
    expect(PAGE_REFERENCE_FIELDS.length).toBe(slotFields.length * 2);
  });

  it('never nests media_container two levels deep', () => {
    expect(PAGE_REFERENCE_FIELDS.some((f) => f.includes('media_container.media_container'))).toBe(false);
  });
});
