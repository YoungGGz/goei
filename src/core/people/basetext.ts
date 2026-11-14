// Director·Router 기본 글: 지침/Director.txt 의 FACTS·SCENE 절, 지침/Router.txt 의 ROLE·RULES 절 (2026-11-14 지침 하나 = 파일 하나).
// 지침 글을 고칠 때는 그 파일만 고친다. 다른 모듈을 들이지 않는다 (core/guides.ts 와 순환 막기)
import director from '../../../지침/Director.txt';
import router from '../../../지침/Router.txt';

const section = (text: string, name: string): string[] =>
  (new RegExp(`@@SECTION ${name}\\n([\\s\\S]*?)\\n@@END`).exec(text.replace(/\r/g, ''))?.[1] ?? '').split('\n');

export const DIRECTOR_FACTS: string[] = section(director, 'FACTS');
export const DIRECTOR_SCENE: string[] = section(director, 'SCENE');
export const ROUTER_SYSTEM: string[] = [...section(router, 'ROLE'), ...section(router, 'RULES')];
