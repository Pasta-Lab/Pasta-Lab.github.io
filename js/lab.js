/* Lab-wide constants. Update here if a PI joins or a name changes. */

export const PIS = [
  { id: 'zhang', name: 'Zhuo Zhang', short: 'Zhuo Zhang', where: 'Columbia' },
  { id: 'wei', name: 'Guannan Wei', short: 'Guannan Wei', where: 'Tufts' },
  { id: 'yang', name: 'Yangruibo Ding', short: 'Robin Ding', where: 'UCLA' },
];

export const BIB_FILES = PIS.map((pi) => `data/publications/${pi.id}.bib`);

export function isPi(name) {
  return PIS.some((pi) => pi.name === name);
}
