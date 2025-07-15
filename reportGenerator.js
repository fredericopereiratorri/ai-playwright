const fs = require('fs');
const path = require('path');

function generateReport(results) {
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir);
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const reportFile = path.join(reportDir, `report_${timestamp}.html`);

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Test Report ${timestamp}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
  th { background-color: #f4f4f4; }
  .pass { color: green; font-weight: bold; }
  .fail { color: red; font-weight: bold; }
  pre { white-space: pre-wrap; }
</style>
</head>
<body>
  <h1>Test Report - ${timestamp}</h1>
  <table>
    <thead>
      <tr>
        <th>Scenario</th>
        <th>URL</th>
        <th>Status</th>
        <th>Priority</th>
        <th>Role</th>
        <th>Error Message</th>
      </tr>
    </thead>
    <tbody>
      ${results
        .map(
          r => `
        <tr>
          <td>${r.name}</td>
          <td><a href="${r.url}" target="_blank">${r.url}</a></td>
          <td class="${r.status === 'PASS' ? 'pass' : 'fail'}">${r.status}</td>
          <td>${r.priority}</td>
          <td>${r.role}</td>
          <td><pre>${r.error || ''}</pre></td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>
`;

  fs.writeFileSync(reportFile, htmlContent, 'utf8');
  console.log(`📝 Report saved to ${reportFile}`);
}

module.exports = { generateReport };
