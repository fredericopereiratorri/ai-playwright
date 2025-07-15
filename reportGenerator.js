const fs = require('fs');
const path = require('path');

function generateReport(results) {
  const reportsDir = path.join(__dirname, 'reports');

  // Create reports directory if missing
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  // Create timestamp string YYYYMMDD_HHMMSS
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '')
    .split('.')[0]; // e.g. 20250715_120305

  const filename = `report_${timestamp}.html`;
  const reportPath = path.join(reportsDir, filename);

  const reportHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Test Scenarios Report - ${timestamp}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 10px; border: 1px solid #ccc; text-align: left; vertical-align: top; }
  th { background-color: #f4f4f4; }
  .pass { background-color: #d4edda; color: #155724; }
  .fail { background-color: #f8d7da; color: #721c24; }
  pre { white-space: pre-wrap; max-width: 600px; margin: 0; }
</style>
</head>
<body>
  <h1>Test Scenarios Report</h1>
  <p><strong>Generated at:</strong> ${now.toLocaleString()}</p>
  <table>
    <thead>
      <tr>
        <th>Scenario</th>
        <th>Page URL</th>
        <th>Status</th>
        <th>Error (if any)</th>
        <th>Priority</th>
        <th>Role</th>
      </tr>
    </thead>
    <tbody>
      ${results.map(r => `
        <tr class="${r.status.toLowerCase()}">
          <td>${r.name}</td>
          <td><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.url}</a></td>
          <td>${r.status}</td>
          <td><pre>${r.error || ''}</pre></td>
          <td>${r.priority || ''}</td>
          <td>${r.role || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(reportPath, reportHtml);
  console.log(`📝 Report saved to ${reportPath}`);
}

module.exports = { generateReport };
