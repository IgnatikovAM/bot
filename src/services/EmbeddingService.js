import { pipeline, env } from '@xenova/transformers';

env.cacheDir = './media/.models';
let embedder;

export async function embed(texts){
  if (!embedder){
    embedder = await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2');
  }
  const out = await embedder(texts,{pooling:'mean',normalize:true});
  return Array.isArray(texts)
    ? out.map(t=>Array.from(t.data))
    : Array.from(out.data);
}
