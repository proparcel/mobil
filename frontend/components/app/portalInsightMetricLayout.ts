/** Genel sekmesi 2 sütunlu metrik grid — ortak kart boyutu */
export const INSIGHT_GRID_CARD_HEIGHT = 118;

export const insightGridCardShell = {
  flex: 1 as const,
  alignSelf: 'stretch' as const,
  height: INSIGHT_GRID_CARD_HEIGHT,
  minWidth: 0,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#bfdbfe',
  backgroundColor: '#f5f9ff',
};
