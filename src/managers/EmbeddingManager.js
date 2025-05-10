import axios from 'axios';
import { pool } from '../db/pool.js';
import { arrToBuf, bufToArr } from '../utils/floatBuffer.js';

const MODEL = 'deepseek-embedding';
const DIM   = 1536;

export class EmbeddingManager {

  static async embed(text){
    const { data } = await axios.post(
      'https://api.deepseek.com/v1/embeddings',
      { model: MODEL, input: text },
      { headers:{ Authorization:`Bearer ${process.env.DEEPSEEK_API_KEY}`}}
    );
    return data.data[0].embedding;
  }

  static async save(chatId, text){
    if (text.length < 15) return;                // очень короткое не индексируем
    const emb = await this.embed(text);
    await pool.query(
      'INSERT INTO long_vectors (chat_id, content, embedding) VALUES (?, ?, ?)',
      [chatId, text, arrToBuf(emb)]
    );
  }

  static cos(a,b){
    let dot=0,na=0,nb=0;
    for (let i=0;i<DIM;i++){
      dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i];
    }
    return dot / (Math.sqrt(na)*Math.sqrt(nb)+1e-8);
  }

  static async recall(chatId, query, limit=3){
    if (query.length < 8) return [];
    const qEmb = await this.embed(query);
    const [rows] = await pool.query(
      'SELECT content, embedding FROM long_vectors WHERE chat_id = ?',
      [chatId]
    );
    return rows
      .map(r=>({content:r.content, score:this.cos(qEmb, bufToArr(r.embedding))}))
      .sort((a,b)=>b.score-a.score)
      .slice(0,limit);
  }
}
