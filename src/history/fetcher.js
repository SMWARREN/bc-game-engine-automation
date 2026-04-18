const { apiRequest } = require('../api/client');
const { logFile } = require('../utils/logger');

async function fetchAllHistory() {
  const allRecords = [];
  let pageNo = 1;
  const pageSize = 50;
  let totalPages = 1;

  try {
    while (pageNo <= totalPages) {
      logFile(`Fetching history page ${pageNo}...`);

      const response = await apiRequest(
        'https://bc.game/api/vault/bc-engine/history/',
        'POST',
        {
          type: 'ALL',
          pageNo,
          pageSize,
        }
      );

      if (response.code !== 0 || !response.data) {
        logFile(`Failed to fetch history page ${pageNo}: ${response.msg}`, 'ERROR');
        break;
      }

      const { list, total, pageSize: returnedPageSize } = response.data;
      if (list && list.length > 0) {
        allRecords.push(...list);
      }

      totalPages = Math.ceil(total / returnedPageSize);
      logFile(`Page ${pageNo}/${totalPages}: fetched ${list?.length || 0} records (total so far: ${allRecords.length})`);
      pageNo++;
    }

    logFile(`History fetch complete: ${allRecords.length} total records`);
    return allRecords;
  } catch (error) {
    logFile(`Failed to fetch history: ${error.message}`, 'ERROR');
    return [];
  }
}

module.exports = { fetchAllHistory };
