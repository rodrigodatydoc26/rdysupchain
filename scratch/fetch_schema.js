const fs = require('fs');
const path = require('path');

// Read app.js to get the API URL and Key
const appJsPath = path.join(__dirname, '../js/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

const urlMatch = appJsContent.match(/const SUPABASE_URL = '([^']+)';/);
const keyMatch = appJsContent.match(/const SUPABASE_KEY = '([^']+)';/);

if (urlMatch && keyMatch) {
  const url = urlMatch[1];
  const key = keyMatch[1];
  
  fetch(`${url}/rest/v1/balanceamento_entregas?select=*&limit=1`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log("Columns available in balanceamento_entregas:", Object.keys(data[0]));
  })
  .catch(err => console.error(err));
} else {
  console.log("Could not find credentials.");
}
