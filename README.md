<div align="center">
  <h1>BubbaBlox Setup Guide</h1>
  <p><i>A refined guide for setting up the BubbaBlox Source Code.</i></p>
</div>

<hr />

<blockquote>
  <strong>Notice:</strong> Please do not contact the maintainers for basic setup help. If you follow this guide properly, you won't need it.
</blockquote>

<blockquote>
  <strong>Quick start (Windows):</strong> run <code>setup.bat</code> from this folder.
  It installs the prerequisites (via winget), installs all dependencies, copies the
  example config files, generates the RSA keys, and builds everything. It then prints
  the few steps that must still be done by hand (editing config values, the hex-patch,
  and registry keys) &mdash; those are covered in the sections below.
</blockquote>

<h2>1. Prerequisites</h2>
<p>Ensure you have the following installed and configured before starting:</p>
<ul>
  <li><strong>Node.js (v18.16.1):</strong> Required for the renderer and build panels.</li>
  <li><strong>PostgreSQL:</strong> The database engine.</li>
  <li><strong>.NET 6.0 SDK:</strong> Required to run the web server.</li>
  <li><strong>Go (v1.20+):</strong> For asset validation.</li>
  <li><strong>Python 3.12:</strong> For image validation and RSA generation.
    <ul>
      <li><em>Important:</em> Check "Add Python to PATH" during installation.</li>
      <li>Run: <code>pip install fastapi aiohttp pydub uvicorn python-magic python-magic-bin==0.4.14 python-multipart cryptography</code></li>
    </ul>
  </li>
  <li><strong>FFMPEG:</strong> Must be installed and added to your System PATH.</li>
</ul>

<hr />

<h2>2. Server Requirements</h2>
<ul>
  <li><strong>OS:</strong> Windows 10/11 or Windows Server (Use Wine/Proxmox for Linux). (i might add basic support for linux in the future)</li>
  <li><strong>Domain:</strong> Must be <strong>exactly 10 characters</strong> (e.g., <code>yoursite.com</code>).</li>
  <li><strong>Networking:</strong> Domain must support both HTTP and HTTPS.</li>
</ul>

<hr />

<h2>3. Database Configuration</h2>
<ol>
  <li>Open Command Prompt as Administrator.</li>
  <li>Navigate to your PostgreSQL bin folder (e.g., <code>C:\Program Files\PostgreSQL\13\bin</code>).</li>
  <li>Move <code>api/sql/schema.sql</code> into this folder.</li>
  <li>Run: <code>psql --username=postgres --dbname=postgres < schema.sql</code></li>
</ol>

<hr />

<h2>4. Backend & Path Setup</h2>
<ol>
  <li><strong>AppSettings:</strong> In <code>Roblox/Roblox.Website</code>, rename <code>appsettings.example.json</code> to <code>appsettings.json</code>.</li>
  <li><strong>Postgres Connection:</strong> Update the "Postgres" string with your password and database name.</li>
  <li><strong>Global Path Fix:</strong> Press <code>CTRL + H</code>. Replace the placeholder path <code>C:\\Users\\Admin\\...</code> with your actual BubbaBlox folder path. <strong>Use double backslashes (\\).</strong></li>
  <li><strong>Renderer Config:</strong> In the <code>renderer</code> folder, rename <code>config.example.json</code> to <code>config.json</code>. Ensure the Authorization keys match your <code>appsettings.json</code>.</li>
</ol>

<hr />

<h2>5. Hex Editing (The 10-Char Patch)</h2>
<p>Since the binaries are hardcoded for 10-character domains, you must manually patch them using <strong>HxD</strong>:</p>
<ul>
  <li>Open <code>RCCService.exe</code> and your <code>Client.exe</code> in HxD.</li>
  <li>Search (CTRL+R) for the string <code>bbblox.org</code>.</li>
  <li>Replace it with your <strong>10-character domain</strong>.</li>
  <li>Update the domain in <code>AppSettings.xml</code> for both the client and RCC.</li>
</ul>

<hr />

<h2>6. RSA Key Generation</h2>
<ol>
  <li>Navigate to <code>Roblox/Roblox.Website/RSA</code>.</li>
  <li>Run <code>python Generate.py</code> to create your public/private keys.</li>
  <li><strong>For 2016/2018 RCC:</strong> Search for <code>BGIAA</code> in HxD and replace the key with the content of your <code>PublicKey2016.pub</code>.</li>
  <li><strong>For 2020 RCC:</strong> Search for <code>MIIBI</code> and replace <strong>every</strong> instance found with your 2020 public key.</li>
</ol>

<h2>Info</h2>
<ol>
  <li>Could in future make a DLL that can auto patch all of this for you just to make it easier. ( would inject everytime RCC starts )</li>
</ol>

<hr />

<h2>7. Registry Keys</h2>
<p>Navigate to <code>HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\ROBLOX Corporation\Roblox</code> in RegEdit:</p>
<ul>
  <li>Create String <code>AccessKey</code>: Set to your <code>RccAuthorization</code> value.</li>
  <li>Create String <code>SettingsKey</code>: Set to a custom string.</li>
  <li>Rename the JSON file in <code>Roblox/Roblox.Libraries/Json</code> to <code>RCCService[YourSettingsKey].json</code>.</li>
</ul>

<hr />

<h2>8. Launch & Final Steps</h2>
<ol>
  <li>Run <code>runall.bat</code> from the main directory.</li>
  <li>Navigate to <code>http://localhost</code> and register. The first account you
      create becomes the owner (user ID 1).</li>
  <li><strong>System accounts are created automatically.</strong> On startup the
      server ensures <code>UGC</code> (ID 2500) and <code>BadDecisions</code> (ID 12)
      exist, both with nullified passwords. You no longer need to create these by
      hand. (To add more, edit <code>UsersService.SystemUsers</code>.)</li>
</ol>

<h2>9. Verify it works</h2>
<ol>
  <li><strong>Website:</strong> <code>http://localhost</code> loads.</li>
  <li><strong>Asset validation:</strong> <code>curl http://localhost:4300/</code>
      returns <code>AssetValidationServiceV2 OK</code>.</li>
  <li><strong>Rendering:</strong> from the <code>renderer</code> folder (with the
      renderer and RCC running) run <code>npm run smoke -- 1818</code> &mdash; it
      should return a PNG.</li>
  <li><strong>Uploads:</strong> upload a T-Shirt (a PNG); it should appear in your
      Creations with a thumbnail.</li>
</ol>

<hr />

<blockquote>
  <strong>Full guide:</strong> see <a href="docs/SETUP.md"><code>docs/SETUP.md</code></a>
  for the architecture overview, port map, R6/R15 rendering details, an
  "Adding assets" section, and a security-hardening checklist to complete before
  going live.
</blockquote>

<div align="center">
  <p><strong>Setup Complete.</strong></p>
</div>
