//@ts-check
import { Window } from 'happy-dom';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

updateGoCodeCoverage();
updateTypeScriptCodeCoverages();

function updateGoCodeCoverage() {
  const coverageReportFilePath = 'apps/api/coverage.html';

  if (!existsSync(coverageReportFilePath)) {
    console.log(`'${coverageReportFilePath}' not found, skipping processing Go coverage`);

    return;
  }

  const window = new Window({ url: 'https://localhost:9999' });
  const document = window.document;

  document.body.innerHTML = readFileSync(coverageReportFilePath, 'utf8');

  const coverageSummaries = Array.from(document.querySelectorAll('select option'))
    .map(option => option.textContent.trim())
    .sort();

  const readmeFilePath = 'apps/api/README.md';
  const readmeFileContent = existsSync(readmeFilePath) ? readFileSync(readmeFilePath, 'utf8').trim() : '';
  const readmeFileContentLines = [
    '# Code coverage',
    '',
    '## AUTO-GENERATED. DO NOT EDIT DIRECTLY. ALL UPDATES MUST BE DONE IN `.circleci/scripts/update-code-coverages.js`',
    '',
    '[Codecov report](https://app.codecov.io/gh/lazycuh/cloudy-clip/tree/staging/apps%2Fapi%2Finternal)',
    '',
    '## Coverage Summary',
    '',
    '|     | File | Coverage |',
    '|-----|------|----------|'
  ];

  if (readmeFileContent === '') {
    for (let i = 0; i < coverageSummaries.length; i++) {
      const { filePath, coveragePercentage } = extractFilePathAndCoveragePercentage(coverageSummaries[i]);
      readmeFileContentLines.push(formatGoCoverageMetricRow(i + 1, filePath, coveragePercentage));
    }
  } else {
    const existingReadmeFileContentLines = readmeFileContent.split(/\n/gm);

    for (let i = 0; i < coverageSummaries.length; i++) {
      const { filePath, coveragePercentage } = extractFilePathAndCoveragePercentage(coverageSummaries[i]);
      const existingCoverageMetricRow = existingReadmeFileContentLines.find(row => row.includes(filePath));

      if (!existingCoverageMetricRow) {
        readmeFileContentLines.push(formatGoCoverageMetricRow(i + 1, filePath, coveragePercentage));
      } else {
        const columns = existingCoverageMetricRow.split('|');
        columns[3] = formatCoverageMetric(columns[3], coveragePercentage);
        readmeFileContentLines.push(columns.join('|'));
      }
    }
  }

  writeFileSync(readmeFilePath, readmeFileContentLines.join('\n'), 'utf8');

  // Aborts any ongoing operations (such as fetch and timers)
  window.happyDOM.abort().then(() => window.close());

  console.log('Processed api coverage');
}

/**
 * @param {string} coverageSummary
 */
function extractFilePathAndCoveragePercentage(coverageSummary) {
  const [filePath, coveragePercentage] = coverageSummary.split(' ');

  return {
    filePath: filePath.replace('github.com/cloudy-clip/api/internal/', ''),
    coveragePercentage: Number(stripAllNonDigitsAndDots(coveragePercentage))
  };
}

/**
 * @param {string} value
 */
function stripAllNonDigitsAndDots(value) {
  return value.replace(/[^0-9.]/g, '');
}

/**
 * @param {string} value
 */
function wrapInBackticks(value) {
  return `${'`'}${value}${'`'}`;
}

/**
 * @param {number} rowNumber
 * @param {string} filePath
 * @param {number} coveragePercentage
 */
function formatGoCoverageMetricRow(rowNumber, filePath, coveragePercentage) {
  const codecovReportUrl = `https://app.codecov.io/gh/lazycuh/cloudy-clip/blob/staging/apps${encodeURIComponent(`/api/internal/${filePath}`)}`;

  return `| ${rowNumber} | [${wrapInBackticks(filePath)}](${codecovReportUrl})  | ${wrapInBackticks(coveragePercentage + '%')} |`;
}

/**
 * @param {string} columnValue
 * @param {number} newValue
 */
function formatCoverageMetric(columnValue, newValue) {
  const currentCoverageMetric = columnValue.trim().split(' ')[0]?.trim() ?? '`-`';
  if (currentCoverageMetric.includes('`-`')) {
    return wrapInBackticks(newValue + '%');
  }

  const delta = newValue - Number(stripAllNonDigitsAndDots(currentCoverageMetric));

  if (delta === 0) {
    return wrapInBackticks(newValue + '%');
  }

  return `${wrapInBackticks(newValue + '%')} (Previously ${currentCoverageMetric}) (${wrapInBackticks((delta > 0 ? '+' : '') + delta.toFixed(2) + '%')})`;
}

function updateTypeScriptCodeCoverages() {
  const packageTable = {
    logging: 'packages/logging/coverage/coverage-summary.json',
    optional: 'packages/optional/coverage/coverage-summary.json',
    web: 'apps/web/coverage/coverage-summary.json'
  };

  const packageTableEntries = Object.entries(packageTable).filter(entry => {
    if (!existsSync(entry[1])) {
      console.log('Coverage summary file not found for', entry[0]);

      return false;
    }

    return true;
  });

  const readmeFileContentLines = readFileSync('README.md', 'utf8')
    .split(/\n/gm)
    .map(line => {
      for (const [packageName, packageCoverageFilePath] of packageTableEntries) {
        if (line.includes(`| [${'`' + packageName + '`'}]`)) {
          const coverageSummary = JSON.parse(readFileSync(packageCoverageFilePath, 'utf8'));
          const columns = line.split('|');

          columns[2] = formatCoverageMetric(columns[2], coverageSummary.total.lines.pct);
          columns[3] = formatCoverageMetric(columns[3], coverageSummary.total.statements.pct);
          columns[4] = formatCoverageMetric(columns[4], coverageSummary.total.branches.pct);
          columns[5] = formatCoverageMetric(columns[5], coverageSummary.total.functions.pct);

          updateCoverageThresholdsInViteConfigFile(packageCoverageFilePath, coverageSummary);

          console.log('Processed', packageName, 'coverage');

          return columns.join('|');
        }
      }

      return line;
    });

  writeFileSync('README.md', readmeFileContentLines.join('\n'), 'utf8');
}

/**
 * @param {string} packageCoverageFilePath
 * @param {{ total: { branches: { pct: any; }; functions: { pct: any; }; lines: { pct: any; }; statements: { pct: any; }; }; }} coverageSummary
 */
function updateCoverageThresholdsInViteConfigFile(packageCoverageFilePath, coverageSummary) {
  const viteConfigFilePath = resolve(packageCoverageFilePath, '..', '..', 'vitest', 'vite.config.ts');

  if (!existsSync(viteConfigFilePath)) {
    throw new Error(`'${viteConfigFilePath}' not found`);
  }

  const updatedViteConfigFileContent = readFileSync(viteConfigFilePath, 'utf8').replace(
    /(branches|functions|lines|statements):\s*\d+(?:\.\d+)?/gm,
    (_, metric) => {
      return `${metric}: ${coverageSummary.total[metric].pct}`;
    }
  );

  writeFileSync(viteConfigFilePath, updatedViteConfigFileContent, 'utf8');
}
