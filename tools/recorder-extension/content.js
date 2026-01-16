// Drizzle Recorder Content Script

(function () {
    const isDrizzleDemo = window.location.hostname.includes("demo.drizzle.studio");
    const isLocalhost = window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1");

    console.log(`🎥 Drizzle Recorder: Loaded (Demo: ${isDrizzleDemo}, Local: ${isLocalhost})`);

    // Create UI
    const btn = document.createElement("button");
    btn.textContent = isDrizzleDemo ? "⏺ Record Comparison" : "⏺ Record Session";
    btn.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 9999;
      background: #ef4444;
      color: white;
      border: 2px solid white;
      border-radius: 9999px;
      padding: 12px 24px;
      font-weight: bold;
      font-family: system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
    `;
    btn.onmouseover = () => btn.style.transform = "scale(1.05)";
    btn.onmouseout = () => btn.style.transform = "scale(1)";
    document.body.appendChild(btn);

    // Recording Logic
    let recorder = null;
    let stream = null;

    btn.onclick = async () => {
        // If already recording, stop it
        if (recorder && recorder.state === "recording") {
            recorder.stop();
            return;
        }

        try {
            // 1. Start Capture
            console.log("Requesting display media...");
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { displaySurface: "browser" },
                audio: false
            });

            // 2. Setup Recorder
            recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            const chunks = [];
            recorder.ondataavailable = e => chunks.push(e.data);

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `drizzle-recording-${new Date().toISOString()}.webm`;
                a.click();
                URL.revokeObjectURL(url);

                if (stream) stream.getTracks().forEach(t => t.stop());

                btn.textContent = isDrizzleDemo ? "⏺ Record Comparison" : "⏺ Record Session";
                btn.style.background = "#ef4444";
            };

            recorder.start();
            btn.textContent = "⏹ Stop Recording";
            btn.style.background = "#22c55e"; // Green

            // 3. Automation (Only for Drizzle Demo)
            if (isDrizzleDemo) {
                const cmContent = document.querySelector('.cm-content');
                if (cmContent) {
                    const view = cmContent.cmView ? cmContent.cmView.view : cmContent._cmView.view;
                    // Run simulation
                    await runSimulation(view);
                    // Auto-stop after simulation
                    await new Promise(r => setTimeout(r, 1000));
                    recorder.stop();
                } else {
                    alert("Editor not found, recording manually...");
                }
            }

        } catch (err) {
            console.error("Recording failed:", err);
            alert("Recording cancelled or failed: " + err.message);
            btn.textContent = isDrizzleDemo ? "⏺ Record Comparison" : "⏺ Record Session";
        }
    };

    // Automation Logic (Same as before)
    async function runSimulation(view) {
        async function type(text, speed = 80) {
            for (const char of text) {
                view.dispatch({
                    changes: { from: view.state.doc.length, insert: char },
                    selection: { anchor: view.state.doc.length + 1 },
                    scrollIntoView: true
                });
                await new Promise(r => setTimeout(r, speed + Math.random() * 30));
            }
        }

        // Clear
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
        await new Promise(r => setTimeout(r, 1500));

        await type("db.");
        await new Promise(r => setTimeout(r, 1200));
        await type("select().");
        await new Promise(r => setTimeout(r, 1000));
        await type("from(users).");
        await new Promise(r => setTimeout(r, 800));
        await type("where(");
        await new Promise(r => setTimeout(r, 600));
        await type("eq(users.id, 1))");
    }
})();
