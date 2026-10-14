import { useEffect, useRef, useState } from "react";
import API_BASE_URL from "./api.js";
import { Html5Qrcode } from "html5-qrcode";
import "./Scanner.css";

function Scanner({ token }) {
  const scannerRef = useRef(null);
  const processingRef = useRef(false);

  const [mode, setMode] = useState(null);
  const [result, setResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  const scanTicket = async (ticketId) => {
if (!ticketId || processingRef.current) {
      return;
    }

    processingRef.current = true;
    setProcessing(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/tickets/${encodeURIComponent(ticketId)}/scan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult({
          type: "error",
          message: data.message || "Entry denied.",
        });

        return;
      }

      setResult({
        type: "success",
        name: data.name,
        ticketId: data.ticketId,
        quantity: data.quantity,
        eventDate: data.eventDate,
      });
    } catch (error) {
      console.error(error);

      setResult({
        type: "error",
        message: "Could not connect to the ticket server.",
      });
    } finally {
      setProcessing(false);
      processingRef.current = false;
    }
  };

  const startCamera = async () => {
    setMode("camera");
    setResult(null);
    setProcessing(false);
    processingRef.current = false;

    await new Promise((resolve) => setTimeout(resolve, 100));

    const scanner = new Html5Qrcode("qr-reader");

    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 260,
            height: 260,
          },
        },
        async (decodedText) => {
          if (processingRef.current) {
            return;
          }

          try {
            await scanner.stop();
          } catch (error) {
            console.error("Scanner stop error:", error);
          }

          scannerRef.current = null;

          await scanTicket(decodedText);
        },
        () => {}
      );
    } catch (error) {
      console.error("Camera error:", error);

      setResult({
        type: "error",
        message: "Could not access the camera.",
      });

      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setMode("upload");
    setResult(null);
    setProcessing(true);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const scannerElement = document.getElementById("qr-reader-upload");

    if (!scannerElement) {
      setProcessing(false);

      setResult({
        type: "error",
        message: "Scanner could not be initialized.",
      });

      return;
    }

    const scanner = new Html5Qrcode("qr-reader-upload");

    try {
      const decodedText = await scanner.scanFile(file, false);

      await scanTicket(decodedText);
    } catch (error) {
      console.error("QR image error:", error);

      setResult({
        type: "error",
        message: "Could not read a valid QR code from this image.",
      });

      processingRef.current = false;
      setProcessing(false);
    }
  };

  const resetScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Scanner already stopped.
      }

      scannerRef.current = null;
    }

    processingRef.current = false;
    setProcessing(false);
    setResult(null);
    setMode(null);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="scanner-page">
      <main className="scanner-container">

        <header className="scanner-header">
          <p className="scanner-brand">CINEMA TALKIES</p>

          <h1>Entry scanner</h1>

          {!result && (
            <p className="scanner-description">
              Scan the QR code on the attendee's pass.
            </p>
          )}
        </header>

        {!mode && !result && (
          <div className="scanner-options">

            <button
              className="scanner-option"
              type="button"
              onClick={startCamera}
            >
              <span className="option-title">
                Use camera
              </span>

              <span className="option-description">
                Scan the QR code directly from the attendee's pass.
              </span>
            </button>

            <label className="scanner-option">
              <span className="option-title">
                Upload QR image
              </span>

              <span className="option-description">
                Select a saved QR image or screenshot.
              </span>

              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                hidden
              />
            </label>

          </div>
        )}

        {mode === "camera" && !result && (
          <section className="camera-section">

            <div className="camera-frame">
              <div id="qr-reader"></div>

              {processing && (
                <div className="camera-status">
                  Checking ticket
                </div>
              )}
            </div>

            {!processing && (
              <p className="camera-instruction">
                Position the QR code inside the frame.
              </p>
            )}

            <button
              className="secondary-button"
              type="button"
              onClick={resetScanner}
            >
              Back
            </button>

          </section>
        )}

        {mode === "upload" && !result && (
          <section className="upload-section">

            <div id="qr-reader-upload"></div>

            {processing && (
              <div className="upload-status">
                <strong>Reading ticket</strong>
                <span>Please wait.</span>
              </div>
            )}

          </section>
        )}

        {result && (
          <section
            className={`scan-result ${
              result.type === "success"
                ? "result-success"
                : "result-error"
            }`}
          >

            <div className="result-heading">
              <span className="result-label">
                {result.type === "success"
                  ? "ENTRY ALLOWED"
                  : "ENTRY DENIED"}
              </span>

              <div className="result-line"></div>
            </div>

            {result.type === "success" ? (
              <>
                <div className="attendee-name">
                  {result.name}
                </div>

                <div className="ticket-meta">

                  <div>
                    <span>TICKET</span>
                    <strong>{result.ticketId}</strong>
                  </div>

                  <div>
                    <span>QUANTITY</span>
                    <strong>{result.quantity}</strong>
                  </div>

                </div>
              </>
            ) : (
              <p className="denied-message">
                {result.message}
              </p>
            )}

            <button
              className="primary-button"
              type="button"
              onClick={resetScanner}
            >
              Scan another ticket
            </button>

          </section>
        )}

      </main>
    </div>
  );
}

export default Scanner;



