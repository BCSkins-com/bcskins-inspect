import { Controller, Get, Query, Res } from '@nestjs/common'
import { FastifyReply } from 'fastify'
import { InspectService } from './inspect.service'
import { InspectDto } from './inspect.dto'

@Controller()
export class InspectController {
    constructor(private readonly inspectService: InspectService) { }

    @Get([
        '',
        'inspect',
        'float',
    ])
    async inspect(
        @Query() query: InspectDto,
        @Res() res: FastifyReply
    ) {
        if (!query || Object.keys(query).length === 0) {
            res.type('text/html').send(this.getApiDocumentation())
            return
        }

        /*
        if (process.env.PASSWORD && query.password !== process.env.PASSWORD) {
            return res.status(401).send({ message: 'Invalid password' })
        }
        */

        const data = await this.inspectService.inspectItem(query)
        return res.send(data)
    }

    @Get('stats')
    async stats() {
        return this.inspectService.stats()
    }

    private getApiDocumentation() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>BCSkins CS2 Inspect API</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Rajdhani', system-ui, sans-serif; 
                        max-width: 1200px; 
                        margin: 0 auto; 
                        padding: 40px 20px; 
                        line-height: 1.6; 
                        background: #0d0e10;
                        color: #e2e3e5; 
                    }
                    h1, h2, h3, h4 { 
                        font-family: 'Orbitron', sans-serif; 
                        font-weight: 700; 
                        color: #14b899;
                        margin-bottom: 16px;
                    }
                    h1 { 
                        font-size: 42px; 
                        margin-top: 24px; 
                        background: linear-gradient(135deg, #14b899 0%, #2dd4b3 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    }
                    h2 { font-size: 32px; margin-top: 48px; }
                    h3 { font-size: 24px; margin-top: 32px; color: #2dd4b3; }
                    h4 { font-size: 18px; margin-top: 24px; color: #5ceacc; }
                    p { margin-bottom: 16px; font-size: 16px; color: #c5c6cb; }
                    pre { 
                        background: #1a1b1e; 
                        padding: 20px; 
                        border-radius: 12px; 
                        overflow-x: auto; 
                        color: #e2e3e5; 
                        border: 1px solid #36373c;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 14px;
                        line-height: 1.6;
                    }
                    .endpoint { 
                        margin-bottom: 40px; 
                        padding: 24px;
                        background: #1a1b1e;
                        border-radius: 12px;
                        border: 1px solid #36373c;
                    }
                    .example { margin: 24px 0; }
                    code { 
                        background: #36373c; 
                        padding: 3px 8px; 
                        border-radius: 6px; 
                        color: #14b899;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 14px;
                    }
                    a { 
                        color: #14b899; 
                        text-decoration: none; 
                        transition: color 0.2s;
                    }
                    a:hover { color: #2dd4b3; }
                    .logo-link { 
                        display: inline-block;
                        margin-bottom: 8px;
                        transition: transform 0.2s;
                    }
                    .logo-link:hover { transform: translateY(-2px); }
                    .logo { 
                        width: 120px; 
                        height: auto;
                    }
                    .logo .st0 { fill: #14b899; }
                    .logo .st1 { fill: #ffffff; }
                    .github-link { 
                        display: inline-flex; 
                        align-items: center; 
                        gap: 10px; 
                        padding: 12px 24px; 
                        background: linear-gradient(135deg, #14b899 0%, #2dd4b3 100%);
                        border-radius: 10px; 
                        margin-top: 16px; 
                        color: #0d0e10;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.2s;
                        box-shadow: 0 4px 12px rgba(20, 184, 153, 0.3);
                    }
                    .github-link:hover { 
                        transform: translateY(-2px); 
                        box-shadow: 0 6px 20px rgba(20, 184, 153, 0.5);
                        color: #0d0e10;
                    }
                    .github-link svg { width: 20px; height: 20px; }
                    input {
                        padding: 14px 18px;
                        border-radius: 10px;
                        border: 2px solid #36373c;
                        background: #1a1b1e;
                        color: #e2e3e5;
                        width: 100%;
                        font-size: 15px;
                        font-family: 'Rajdhani', sans-serif;
                        transition: all 0.2s;
                        outline: none;
                    }
                    input:focus {
                        border-color: #14b899;
                        box-shadow: 0 0 0 3px rgba(20, 184, 153, 0.2);
                    }
                    input::placeholder {
                        color: #7b7e87;
                    }
                    button {
                        padding: 14px 32px;
                        border-radius: 10px;
                        border: none;
                        background: linear-gradient(135deg, #14b899 0%, #2dd4b3 100%);
                        color: #0d0e10;
                        font-weight: 600;
                        font-size: 16px;
                        font-family: 'Rajdhani', sans-serif;
                        cursor: pointer;
                        transition: all 0.2s;
                        margin-left: 12px;
                        box-shadow: 0 4px 12px rgba(20, 184, 153, 0.3);
                    }
                    button:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(20, 184, 153, 0.5);
                    }
                    button:active {
                        transform: translateY(0);
                    }
                    form {
                        margin: 32px 0;
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                    }
                    .form-input-wrapper {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                    }
                    .error-message {
                        color: #ff3352;
                        font-size: 14px;
                        margin-top: 8px;
                        display: none;
                        font-weight: 500;
                    }
                    input.error {
                        border-color: #ff3352;
                    }
                    input.error:focus {
                        border-color: #ff3352;
                        box-shadow: 0 0 0 3px rgba(255, 51, 82, 0.2);
                    }
                    ul {
                        margin: 16px 0;
                        padding-left: 24px;
                    }
                    li {
                        margin: 8px 0;
                        color: #c5c6cb;
                        font-size: 16px;
                    }
                    .header-section {
                        text-align: center;
                        padding: 40px 0;
                        border-bottom: 2px solid #36373c;
                        margin-bottom: 40px;
                    }
                    .subtitle {
                        color: #a0a2a9;
                        font-size: 18px;
                        margin-top: 16px;
                    }
                    @media (max-width: 768px) {
                        h1 { font-size: 32px; }
                        h2 { font-size: 24px; }
                        form { flex-direction: column; }
                        button { margin-left: 0; margin-top: 12px; width: 100%; }
                    }
                </style>
            </head>
            <body>
                <div class="header-section">
                    <a href="https://bcskins.com" class="logo-link" target="_blank">
                        <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580.27 567.09">
                            <g>
                                <path class="st0" d="M289.73,510.45c-45.68-0.01-91.35,0.02-137.03-0.01c-49.32-0.04-89.54-40.31-89.55-89.65
                                    c-0.01-91.33-0.01-182.65,0.01-273.98c0.01-45.78,34.47-84.6,79.83-89.9c3.23-0.38,6.52-0.27,9.78-0.27
                                    c91.72-0.02,183.43-0.04,275.15-0.01c49.02,0.02,89.16,40.23,89.18,89.36c0.04,91.87,0.05,183.74,0.01,275.61
                                    c-0.02,48.22-40.54,88.75-88.71,88.85c-23.2,0.05-46.4,0.01-69.6,0.01C335.77,510.46,312.75,510.46,289.73,510.45z M289.8,413.27
                                    c51.83,0,103.66,0,155.49,0c15.47,0,20.26-4.73,20.28-20.04c0.02-27.18,0.01-54.35,0.01-81.53c0-9.2-0.96-10.15-10.39-10.15
                                    c-36.24-0.01-72.49,0-108.73-0.02c-8.03,0-9.06-1.05-9.07-9.12c-0.02-23.37-0.01-46.74-0.01-70.11c0-14.39,0-14.39,14.27-14.39
                                    c34.07,0,68.14,0,102.21,0c10.61,0,10.82-0.22,10.83-11.08c0-4.53,0.01-9.06,0-13.59c-0.02-8.68-0.29-8.97-8.75-8.98
                                    c-39.87-0.01-79.75,0.53-119.6-0.25c-17.14-0.33-32.97,16.23-32.74,32.3c0.48,32.24,0.03,64.49,0.17,96.74
                                    c0.08,18.64,13.84,32.1,32.47,32.13c29,0.04,57.99,0.1,86.99-0.06c5.11-0.03,7.08,1.58,6.96,6.87c-0.3,12.31-0.08,24.64-0.1,36.96
                                    c-0.01,7.41-0.15,7.55-7.67,7.55c-45.12,0.01-90.25,0-135.37,0c-42.04,0-84.09,0-126.13,0c-9.66,0-9.54-0.01-9.72-9.91
                                    c-0.08-4.31-0.16-8.78-1.28-12.89c-2.37-8.64-11.51-13.3-21.87-11.82c-8.28,1.19-12.22,6.38-12.28,16.36
                                    c-0.06,8.88-0.02,17.75-0.01,26.63c0.02,14.12,4.33,18.41,18.58,18.41C186.15,413.28,237.97,413.28,289.8,413.27z M116.83,254.95
                                    c0,23.72-0.01,47.45,0.01,71.17c0.01,8.28,0.76,9.05,8.97,9.06c40.22,0.02,80.44-0.47,120.65,0.24
                                    c16.11,0.29,33.2-15.84,32.32-32.04c-0.56-10.29-0.33-20.65,0.01-30.96c0.26-7.87-1.38-15.05-5.46-21.77
                                    c-0.89-1.46-4.53-3.62-4.52-5.31c0.02-13.4,3.37-26.51,3.34-39.91c-0.03-17.16-13.93-31.12-31.04-31.16
                                    c-38.59-0.08-77.17-0.04-115.76-0.02c-7.56,0-8.5,0.94-8.5,8.43C116.81,206.77,116.83,230.86,116.83,254.95z"/>
                                <path class="st1" d="M289.8,413.27c-51.83,0.01-103.66,0.01-155.49,0c-14.25,0-18.56-4.29-18.58-18.41
                                    c-0.01-8.88-0.04-17.75,0.01-26.63c0.06-9.98,4-15.17,12.28-16.36c10.36-1.49,19.51,3.18,21.87,11.82
                                    c1.13,4.11,1.21,8.57,1.28,12.89c0.18,9.91,0.06,9.91,9.72,9.91c42.04,0,84.09,0,126.13,0c45.12,0,90.25,0.01,135.37,0
                                    c7.52,0,7.65-0.14,7.67-7.55c0.02-12.32-0.2-24.64,0.1-36.96c0.13-5.29-1.85-6.9-6.96-6.87c-28.99,0.16-57.99,0.11-86.99,0.06
                                    c-18.62-0.03-32.38-13.49-32.47-32.13c-0.15-32.25,0.3-64.5-0.17-96.74c-0.24-16.07,15.6-32.63,32.74-32.3
                                    c39.85,0.78,79.73,0.24,119.6,0.25c8.46,0,8.73,0.3,8.75,8.98c0.01,4.53,0,9.06,0,13.59c-0.01,10.86-0.22,11.08-10.83,11.08
                                    c-34.07,0-68.14,0-102.21,0c-14.27,0-14.27,0-14.27,14.39c0,23.37-0.01,46.74,0.01,70.11c0.01,8.07,1.04,9.11,9.07,9.12
                                    c36.24,0.02,72.49,0.01,108.73,0.02c9.43,0,10.39,0.95,10.39,10.15c0,27.18,0.01,54.35-0.01,81.53
                                    c-0.01,15.31-4.81,20.04-20.28,20.04C393.46,413.27,341.63,413.27,289.8,413.27z"/>
                                <path class="st1" d="M116.83,254.95c0-24.09-0.02-48.17,0.01-72.26c0.01-7.49,0.95-8.43,8.5-8.43
                                    c38.59-0.02,77.17-0.07,115.76,0.02c17.11,0.04,31.32,14,31.04,31.16c-0.22,13.73-0.82,25.68-0.84,39.08
                                    c0,1.69-1.02,2.68,2.03,6.14c5.19,5.9,5.91,14.66,5.93,22.54c0.02,10.36,0.02,19.34-0.48,30.19c0.88,16.2-16.21,32.33-32.32,32.04
                                    c-40.2-0.72-80.43-0.23-120.65-0.24c-8.21,0-8.96-0.78-8.97-9.06C116.82,302.4,116.83,278.67,116.83,254.95z M197.61,301.52
                                    c13.75,0,27.49-0.03,41.24,0.02c3.41,0.01,6.17-0.4,6.12-4.82c-0.09-7.23-0.06-14.47-0.03-21.7c0.02-3.73-1.98-5.08-5.47-5.08
                                    c-27.67,0.03-55.35,0.03-83.02-0.01c-3.6-0.01-5.29,1.44-5.22,5.18c0.13,6.69,0.23,13.39-0.04,20.07
                                    c-0.18,4.67,1.54,6.47,6.27,6.4C170.84,301.4,184.23,301.52,197.61,301.52z M194.4,236.27c12.69,0,25.37-0.06,38.06,0.04
                                    c4.05,0.03,6.09-1.49,6-5.72c-0.11-5.61-0.11-11.23,0-16.85c0.09-4.12-1.7-5.87-5.86-5.86c-25.37,0.08-50.74,0.06-76.11,0.02
                                    c-3.61-0.01-5.34,1.41-5.25,5.16c0.13,5.43,0.27,10.88-0.06,16.3c-0.31,5.13,1.51,7.13,6.8,7.01
                                    C170.11,236.09,182.26,236.28,194.4,236.27z"/>
                                <path class="st0" d="M197.61,301.52c-13.39,0-26.77-0.13-40.15,0.07c-4.73,0.07-6.45-1.73-6.27-6.4
                                    c0.26-6.68,0.17-13.38,0.04-20.07c-0.07-3.73,1.62-5.18,5.22-5.18c27.67,0.04,55.35,0.03,83.02,0.01c3.49,0,5.49,1.34,5.47,5.08
                                    c-0.03,7.23-0.07,14.47,0.03,21.7c0.06,4.41-2.7,4.83-6.12,4.82C225.11,301.49,211.36,301.52,197.61,301.52z"/>
                                <path class="st0" d="M194.4,236.28c-12.14,0.01-24.29-0.18-36.42,0.09c-5.28,0.12-7.1-1.89-6.8-7.01
                                    c0.33-5.42,0.18-10.87,0.06-16.3c-0.09-3.75,1.64-5.16,5.25-5.16c25.37,0.05,50.74,0.06,76.11-0.02c4.16-0.01,5.95,1.74,5.86,5.86
                                    c-0.12,5.61-0.12,11.23,0,16.85c0.08,4.22-1.95,5.75-6,5.72C219.77,236.21,207.08,236.27,194.4,236.28z"/>
                            </g>
                        </svg>
                    </a>
                    <h1>CS2 Inspect API</h1>
                    <p class="subtitle">Powered by BCSkins - Real-time inspection data for CS2 items</p>
                    <a href="https://github.com/BCSkins-com/bcskins-inspect" class="github-link" target="_blank">
                        <svg viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                        </svg>
                        View on GitHub
                    </a>
                </div>

                <div>
                    <h2>Test Inspection</h2>
                    <form id="inspectForm" action="/inspect" method="get" onsubmit="return validateForm(event)">
                        <div class="form-input-wrapper">
                            <input 
                                type="text" 
                                name="url" 
                                id="inspectLink"
                                placeholder="Paste your Steam inspect link here..." 
                            />
                            <div id="errorMessage" class="error-message">
                                Please enter a valid CS2 inspect link (steam://rungame/...)
                            </div>
                        </div>
                        <button type="submit">Inspect</button>
                    </form>
                </div>

                <script>
                    function validateForm(event) {
                        event.preventDefault();
                        
                        const input = document.getElementById('inspectLink');
                        const errorMessage = document.getElementById('errorMessage');
                        const value = input.value.trim();

                        // Reset previous error state
                        input.classList.remove('error');
                        errorMessage.style.display = 'none';

                        // Check if empty
                        if (!value) {
                            showError('Please enter an inspect link');
                            return false;
                        }

                        // Validate steam inspect URL format
                        const steamUrlPattern = /^(?:steam:\\/\\/rungame\\/730\\/|https?:\\/\\/(?:www\\.)?steamcommunity\\.com\\/market\\/listings\\/730\\/.*[?&]inspectlink=steam:\\/\\/rungame\\/730\\/)/i;
                        
                        // Check for S, A, D, M parameters format
                        const paramPattern = /[?&](?:s=\\d+&a=\\d+&d=\\d+&m=\\d+|[SADM]=\\d+)/i;

                        if (!steamUrlPattern.test(value) && !paramPattern.test(value)) {
                            showError('Please enter a valid CS2 inspect link');
                            return false;
                        }

                        // If validation passes, manually submit the form
                        window.location.href = \`/inspect?url=\${encodeURIComponent(value)}\`;
                        return true;
                    }

                    function showError(message) {
                        const input = document.getElementById('inspectLink');
                        const errorMessage = document.getElementById('errorMessage');
                        
                        input.classList.add('error');
                        errorMessage.textContent = message;
                        errorMessage.style.display = 'block';
                        
                        return false;
                    }

                    // Update the input event listener to not trigger form submission
                    document.getElementById('inspectLink').addEventListener('input', function() {
                        const errorMessage = document.getElementById('errorMessage');
                        if (!this.value.trim()) {
                            this.classList.remove('error');
                            errorMessage.style.display = 'none';
                        }
                    });
                </script>

                <div class="endpoint">
                    <h2>API Documentation</h2>
                    
                    <h3>GET /inspect</h3> 
                    <p>Inspect a CS2 item using various input methods.</p>

                    <h4>Query Parameters:</h4>
                    <ul>
                        <li><code>link</code> - Steam inspect link</li>
                        <li><code>s</code> - param S from inspect link</li>
                        <li><code>a</code> - param A from inspect link</li>
                        <li><code>d</code> - param D from inspect link</li>
                        <li><code>m</code> - param M from inspect link</li>
                        <li><code>refresh</code> - (optional) Set to true to refresh sticker data (if enabled)</li>
                    </ul>

                    <div class="example">
                        <h4>Example Requests:</h4>
                        <pre>GET /inspect?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198023809011A40368145941D14586214085613790969</pre>
                        <pre>GET /inspect?s=76561198023809011&a=40368145941&d=14586214085613790969</pre>
                    </div>

                    <div class="example">
                        <h4>Example Response:</h4>
                        <pre>{
  "iteminfo": {
    "defindex": 16,
    "paintindex": 309,
    "rarity": 7,
    "quality": 4,
    "origin": 8,
    "floatvalue": 0.1572919487953186,
    "paintseed": 826,
    "wear_name": "Field-Tested",
    "market_hash_name": "M4A4 | Howl (Field-Tested)",
    "stickers": [
      {
        "slot": 3,
        "wear": 0.11459143459796906,
        "scale": null,
        "pattern": null,
        "tint_id": null,
        "offset_x": null,
        "offset_y": null,
        "offset_z": null,
        "rotation": null,
        "sticker_id": 202,
        "market_hash_name": "Sticker | Cloud9 (Holo) | DreamHack 2014"
      }
    ],
    "keychains": [
      {
        "slot": 0,
        "wear": null,
        "scale": null,
        "pattern": 22820,
        "tint_id": null,
        "offset_x": 10.525607109069824,
        "offset_y": 0.578781008720398,
        "offset_z": 12.312423706054688,
        "rotation": null,
        "sticker_id": 19,
        "market_hash_name": "Charm | Pocket AWP"
      }
    ],
    "image": "https://community.cloudflare.steamstatic.com/economy/image/...",
    "type": "Weapon",
    "souvenir": false,
    "stattrak": false
  }
}</pre>
                    </div>

                    <h3>GET /stats</h3>
                    <p>Get bot statistics and status information.</p>

                    <div class="example">
                        <h4>Example Request:</h4>
                        <pre>GET /stats</pre>
                    </div>
                </div>  
            </body>
            </html>
        `
    }
}
