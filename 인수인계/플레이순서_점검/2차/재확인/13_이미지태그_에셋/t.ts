import { finishAsset, splitNarrative, paragraphs } from '../../../../../src/core/asset';
import { stripShopTags } from '../../../../../src/core/shop';
const content = '잼트리가 웃었다.\n\n매점 안은 조용했다.\n\n[shop: 관리국 매점|]\n[▣|상태]';
const { leading, narrative, trailing, raw } = splitNarrative(content);
const paras = paragraphs(narrative);
const d:any = { characters:['Jamtree'], keywordSet:new Set(['smile']), keywords:['smile'], aliases:new Map([['잼트리','Jamtree']]) };
const job:any = { original: content, paras, leading, trailing, raw, messages: [] };
for (const line of [2,3]) {
  const out = finishAsset(job, JSON.stringify([{line, tag:'<img="Jamtree_smile">'}]), d, 3)!;
  console.log('line',line, JSON.stringify(stripShopTags(out)));
}
