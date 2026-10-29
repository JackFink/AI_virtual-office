// collect.js - MapleStory Complete Collector (Character, Furniture, Pet, Building, Decoration)
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGION = 'KMS';
const VERSION = '389';
const BASE_API = 'https://maplestory.io/api';

const DATA_DIR = path.join(__dirname, 'data');
const IMG_DIR = path.join(__dirname, 'images');
const DASH_DIR = path.join(__dirname, 'dashboard');

// 수집 대상 아이템 카테고리 정의
const TARGET_CATEGORIES = [
  { folder: 'hair', overall: 'Equip', subCategory: 'Hair', label: '헤어' },
  { folder: 'face', overall: 'Equip', subCategory: 'Face', label: '표정/성형' },
  { folder: 'clothes', overall: 'Equip', subCategory: 'Overall', label: '한벌옷' },
  { folder: 'clothes', overall: 'Equip', subCategory: 'Top', label: '상의' },
  { folder: 'clothes', overall: 'Equip', subCategory: 'Bottom', label: '하의' },
  { folder: 'shoes', overall: 'Equip', subCategory: 'Shoes', label: '신발' },
  { folder: 'accessories', overall: 'Equip', subCategory: 'Hat', label: '모자' },
  { folder: 'accessories', overall: 'Equip', subCategory: 'Face Accessory', label: '얼굴장식' },
  { folder: 'accessories', overall: 'Equip', subCategory: 'Eye Decoration', label: '눈장식' },
  { folder: 'accessories', overall: 'Equip', subCategory: 'Earrings', label: '귀고리' },
  { folder: 'accessories', overall: 'Equip', subCategory: 'Cape', label: '망토' },
  { folder: 'accessories', overall: 'Equip', subCategory: 'Glove', label: '장갑' },
  // 🪑 가구 / 설치 / 의자
  { folder: 'furniture', overall: 'Setup', subCategory: 'Chair', label: '가구/의자' },
  // 🐾 펫 장비
  { folder: 'pet', overall: 'Equip', subCategory: 'Pet Equipment', label: '펫장비' },
  // ✨ 장식품 / 이펙트 (신규 추가)
  { folder: 'decoration', overall: 'Cash', subCategory: 'Effect', label: '캐시이펙트' },
  { folder: 'decoration', overall: 'Equip', subCategory: 'Ring', label: '반지/명찰' },
  { folder: 'decoration', overall: 'Setup', subCategory: 'Title', label: '칭호장식' },
  { folder: 'decoration', overall: 'Setup', subCategory: 'Decoration', label: '설치장식' }
];

const SKINS = [
  { id: 2000, name: '크림 피부 (기본)', category: 'skin', subCategory: 'Skin' },
  { id: 2001, name: '태닝 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2002, name: '창백한 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2003, name: '노란 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2004, name: '초록 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2010, name: '메르세데스 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2012, name: '데몬 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2015, name: '뽀송 꽃잎 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2016, name: '홍조 꽃잎 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2018, name: '뽀송 라벤더 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2019, name: '홍조 라벤더 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2024, name: '스프링 블라썸 피부', category: 'skin', subCategory: 'Skin' },
  { id: 2025, name: '블루 스킨', category: 'skin', subCategory: 'Skin' }
];

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(IMG_DIR, { recursive: true });
  await fs.mkdir(DASH_DIR, { recursive: true });
  const folders = ['hair', 'face', 'clothes', 'shoes', 'accessories', 'skin', 'furniture', 'pet', 'building', 'decoration'];
  for (const f of folders) {
    await fs.mkdir(path.join(IMG_DIR, f), { recursive: true });
  }
}

async function downloadQueue(tasks, concurrency = 15, onProgress = null) {
  let index = 0;
  let completed = 0;
  const total = tasks.length;

  async function worker() {
    while (index < tasks.length) {
      const current = tasks[index++];
      try {
        await current();
      } catch (err) {}
      completed++;
      if (onProgress && completed % 50 === 0) {
        onProgress(completed, total);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  if (onProgress) onProgress(completed, total);
}

async function fetchCategoryItems(target) {
  const url = `${BASE_API}/${REGION}/${VERSION}/item?overallCategoryFilter=${target.overall}&subCategoryFilter=${encodeURIComponent(target.subCategory)}`;
  console.log(`🌐 [${target.label}] 목록 요청 중... (${target.subCategory})`);
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const items = await res.json();
    console.log(`  -> ${target.label} (${target.subCategory}): 총 ${items.length}개 발견`);
    return items;
  } catch (e) {
    console.error(`❌ ${target.subCategory} 에러: ${e.message}`);
    return [];
  }
}

async function fetchPetItems() {
  const url = `${BASE_API}/${REGION}/${VERSION}/pet`;
  console.log(`🐾 [펫] 전체 목록 요청 중...`);
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const pets = await res.json();
    console.log(`  -> 펫 (Pet): 총 ${pets.length}마리 발견`);
    return pets;
  } catch (e) {
    console.error(`❌ 펫 에러: ${e.message}`);
    return [];
  }
}

async function fetchBuildingMaps() {
  const url = `${BASE_API}/${REGION}/${VERSION}/map`;
  console.log(`🏛️ [건물/배경 맵] 전체 목록 요청 중...`);
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const maps = await res.json();
    // 건물, 실내, 민가, 상점, 연구소, 성, 궁전, 하우스 등 필터링
    const buildings = maps.filter(m => 
      m.name && (
        m.name.includes('집') || 
        m.name.includes('민가') || 
        m.name.includes('성') || 
        m.name.includes('상점') || 
        m.name.includes('연구소') || 
        m.name.includes('궁전') || 
        m.name.includes('도서관') || 
        m.name.includes('본부') || 
        m.name.includes('마을') ||
        m.name.includes('타운') ||
        m.name.includes('홀') ||
        m.name.includes('방') ||
        m.name.includes('본당') ||
        m.name.includes('아지트')
      )
    );
    console.log(`  -> 건물/공간 맵: 총 ${buildings.length}개 발견 (전체 ${maps.length}개 중 필터링)`);
    return buildings;
  } catch (e) {
    console.error(`❌ 건물 맵 에러: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log('========================================================================');
  console.log('🍁 MapleStory.io 종합 수집기 v4.0 (캐릭터, 가구, 펫, 건물, 장식품)');
  console.log(`🌍 서버: ${REGION}, 클라이언트 버전: ${VERSION}`);
  console.log('========================================================================\n');

  await ensureDirs();

  const allParts = [];
  const processedIds = new Set();
  const downloadTasks = [];

  // 1. 피부 스킨
  for (const s of SKINS) {
    allParts.push({
      id: s.id,
      name: s.name,
      category: s.category,
      subCategory: s.subCategory,
      isCash: true,
      icon: null,
      iconUrl: null
    });
  }

  // 2. 파츠, 가구, 펫장비, 장식품/이펙트 수집
  for (const target of TARGET_CATEGORIES) {
    const items = await fetchCategoryItems(target);

    for (const item of items) {
      if (processedIds.has(item.id)) continue;
      processedIds.add(item.id);

      const iconUrl = `${BASE_API}/${REGION}/${VERSION}/item/${item.id}/icon`;
      const fileName = `${item.id}.png`;
      const destPath = path.join(IMG_DIR, target.folder, fileName);
      const relPath = `images/${target.folder}/${fileName}`;

      const exists = fsSync.existsSync(destPath);

      allParts.push({
        id: item.id,
        name: item.name || `아이템 ${item.id}`,
        category: target.folder,
        subCategory: target.subCategory,
        isCash: item.isCash || false,
        icon: exists ? relPath : null,
        iconUrl: iconUrl
      });

      if (!exists) {
        downloadTasks.push(async () => {
          try {
            const r = await fetch(iconUrl);
            if (r.ok) {
              const buf = Buffer.from(await r.arrayBuffer());
              await fs.writeFile(destPath, buf);
            }
          } catch (e) {}
        });
      }
    }
  }

  // 3. 펫 (Pets) 수집
  const pets = await fetchPetItems();
  for (const pet of pets) {
    if (processedIds.has(pet.id)) continue;
    processedIds.add(pet.id);

    const iconUrl = `${BASE_API}/${REGION}/${VERSION}/item/${pet.id}/icon`;
    const fileName = `${pet.id}.png`;
    const destPath = path.join(IMG_DIR, 'pet', fileName);
    const relPath = `images/pet/${fileName}`;

    const exists = fsSync.existsSync(destPath);

    allParts.push({
      id: pet.id,
      name: pet.name || `펫 ${pet.id}`,
      category: 'pet',
      subCategory: 'Pet',
      isCash: true,
      icon: exists ? relPath : null,
      iconUrl: iconUrl
    });

    if (!exists) {
      downloadTasks.push(async () => {
        try {
          const r = await fetch(iconUrl);
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            await fs.writeFile(destPath, buf);
          }
        } catch (e) {}
      });
    }
  }

  // 4. 🏛️ 건물 / 공간 배경 맵 수집
  const buildings = await fetchBuildingMaps();
  for (const b of buildings) {
    const buildId = b.id;
    if (processedIds.has(buildId)) continue;
    processedIds.add(buildId);

    const iconUrl = `${BASE_API}/${REGION}/${VERSION}/map/${buildId}/icon`;
    const renderUrl = `${BASE_API}/${REGION}/${VERSION}/map/${buildId}/render/0`;
    const fileName = `${buildId}.png`;
    const destPath = path.join(IMG_DIR, 'building', fileName);
    const relPath = `images/building/${fileName}`;

    const exists = fsSync.existsSync(destPath);

    allParts.push({
      id: buildId,
      name: `${b.name} (${b.streetName || '메이플 월드'})`,
      category: 'building',
      subCategory: b.streetName || '건물/공간',
      isCash: false,
      icon: exists ? relPath : null,
      iconUrl: iconUrl,
      bgUrl: renderUrl // 뷰포트 배경 렌더링용
    });

    if (!exists) {
      downloadTasks.push(async () => {
        try {
          const r = await fetch(iconUrl);
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            await fs.writeFile(destPath, buf);
          }
        } catch (e) {}
      });
    }
  }

  // 요약 통계
  const summary = {
    region: REGION,
    version: VERSION,
    updatedAt: new Date().toISOString(),
    totalParts: allParts.length,
    counts: {
      skin: allParts.filter(p => p.category === 'skin').length,
      hair: allParts.filter(p => p.category === 'hair').length,
      face: allParts.filter(p => p.category === 'face').length,
      clothes: allParts.filter(p => p.category === 'clothes').length,
      shoes: allParts.filter(p => p.category === 'shoes').length,
      accessories: allParts.filter(p => p.category === 'accessories').length,
      furniture: allParts.filter(p => p.category === 'furniture').length,
      pet: allParts.filter(p => p.category === 'pet').length,
      building: allParts.filter(p => p.category === 'building').length,
      decoration: allParts.filter(p => p.category === 'decoration').length
    }
  };

  console.log('\n📊 [메타데이터 수집 완료]');
  console.log(`총 수집 아이템: ${allParts.length.toLocaleString()}개`);
  console.table(summary.counts);

  // 저장
  console.log('💾 전체 데이터 파일 저장 중...');
  await fs.writeFile(path.join(DATA_DIR, 'parts.json'), JSON.stringify(allParts), 'utf-8');
  await fs.writeFile(path.join(DATA_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');
  await fs.writeFile(path.join(DASH_DIR, 'parts.json'), JSON.stringify(allParts), 'utf-8');
  await fs.writeFile(path.join(DASH_DIR, 'data.js'), `window.__MAPLE_DATA__ = ${JSON.stringify({ summary, parts: allParts })};`, 'utf-8');
  console.log('✅ 데이터 저장 완료 (data/parts.json, dashboard/data.js)');

  // 이미지 다운로드
  console.log(`\n📥 신규 이미지 다운로드: ${downloadTasks.length.toLocaleString()}개 대상 (병렬 15개 풀)`);
  if (downloadTasks.length > 0) {
    const startTime = Date.now();
    await downloadQueue(downloadTasks, 15, (done, total) => {
      const pct = ((done / total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(`\r🚀 신규 이미지 다운로드 중: ${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%) [${elapsed}초]`);
    });
    console.log('\n✨ 신규 이미지 다운로드 완료!');
  } else {
    console.log('🎉 모든 아이템의 이미지가 이미 로컬에 완벽히 다운로드되어 있습니다.');
  }

  console.log('\n🎉 [작업 완료] 대시보드에서 건물과 장식품을 확인하세요!');
}

main().catch(err => {
  console.error('치명적 에러:', err);
  process.exit(1);
});
