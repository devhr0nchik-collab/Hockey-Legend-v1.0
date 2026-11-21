// ============================================================
// Этап 3.2: справка по атрибутам и доступный тултип.
// ATTRIBUTE_INFO RU/EN, data-attr, кнопка «?», Escape, экран справки.
// ============================================================
import 'fake-indexeddb/auto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_HTML = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const HL = () => window.__HL;
let LANG = null;

beforeAll(async () => {
    window.matchMedia = window.matchMedia || ((query) => ({
        matches: false, media: query, onchange: null,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; }
    }));

    const body = INDEX_HTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    document.body.innerHTML = body[1].replace(/<script[\s\S]*?<\/script>/gi, '');

    localStorage.setItem('hockeyLegendLang', 'ru');
    await import('../i18n.js');
    await import('../datapack_rosters.js');
    await import('../script.js');
    await import('../datapack.js');
    ({ LANG } = await import('../i18n.js'));

    document.getElementById('btn-new-game').click();
    document.getElementById('ca-name').value = 'Атрибуты Тест';
    document.getElementById('ca-agency').value = 'Attr Agency';
    document.getElementById('ca-start').click();
    HL().addClient('Атрибутный Клиент');
});

afterAll(() => {
    HL().hideAttrTooltipNow();
    LANG.set('ru');
});

const ATTRIBUTES = ['attack', 'defense', 'technique', 'psyche', 'physics', 'speed', 'potential'];

describe('3.2 ATTRIBUTE_INFO: описания RU/EN', () => {
    it('у всех шести атрибутов и потенциала есть название и описание', () => {
        expect(HL().attributeKeys()).toEqual(ATTRIBUTES);
        for (const key of ATTRIBUTES) {
            const info = HL().attributeInfoProbe(key);
            expect(info).toBeTruthy();
            expect(info.name.length).toBeGreaterThan(0);
            expect(info.desc.length).toBeGreaterThan(5);
        }
    });

    it('описания переводятся на EN и обратно на RU', () => {
        const ru = {};
        for (const key of ATTRIBUTES) ru[key] = HL().attributeInfoProbe(key).desc;

        LANG.set('en');
        for (const key of ATTRIBUTES) {
            const en = HL().attributeInfoProbe(key);
            expect(en.desc.length).toBeGreaterThan(5);
            expect(en.desc).not.toBe(ru[key]);
        }

        LANG.set('ru');
        for (const key of ATTRIBUTES) {
            expect(HL().attributeInfoProbe(key).desc).toBe(ru[key]);
        }
    });
});

describe('3.2 data-attr и иконка помощи', () => {
    it('ppAttrBar содержит data-attr и кнопку «?»', () => {
        const html = HL().ppAttrBarHTML('Атака', 82, 'attack');
        expect(html).toContain('data-attr="attack"');
        expect(html).toContain('data-attr-help="attack"');
        expect(html).toContain('>?</button>');
    });

    it('buildTalentCard содержит data-attr и кнопки помощи', () => {
        const html = HL().buildTalentCardHTML('Атрибутный Клиент');
        expect(html).toContain('data-attr="attack"');
        expect(html).toContain('data-attr="defense"');
        expect(html).toContain('data-attr="potential"');
        expect(html).toContain('data-attr-help="attack"');
        expect(html).toContain('data-attr-help="potential"');
    });

    it('renderPlayerDevelopment использует те же data-attr и помощь', () => {
        const html = HL().developmentHTMLForTest('Атрибутный Клиент');
        expect(html).toContain('data-attr="attack"');
        expect(html).toContain('data-attr="speed"');
        expect(html).toContain('data-attr-help="attack"');
    });
});

describe('3.2 тултип и экран справки', () => {
    it('тултип открывается по клику и закрывается по Escape', () => {
        const wrap = document.createElement('div');
        wrap.innerHTML = HL().buildTalentCardHTML('Атрибутный Клиент');
        document.body.appendChild(wrap);

        const btn = wrap.querySelector('[data-attr-help="attack"]');
        expect(btn).toBeTruthy();
        btn.click();

        let st = HL().attrTooltipState();
        expect(st.open).toBe(true);
        expect(st.attr).toBe('attack');
        expect(st.pinned).toBe(true);
        expect(st.text).toContain('Атака');
        expect(st.text).toContain('Завершение атак');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        st = HL().attrTooltipState();
        expect(st.open).toBe(false);

        wrap.remove();
    });

    it('экран «Об игре» содержит справку по всем атрибутам', () => {
        expect(HL().openAboutNow()).toBe('flex');
        const html = document.getElementById('about-attributes').innerHTML;
        for (const key of ATTRIBUTES) {
            expect(html).toContain(`data-attr="${key}"`);
            expect(html).toContain(HL().attributeInfoProbe(key).desc);
        }
        document.getElementById('about-modal').style.display = 'none';
    });
});
