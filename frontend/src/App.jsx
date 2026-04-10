import { useState, useRef } from 'react'
import './App.css'

const API = 'http://localhost:8000/api/v1'

const MARKETS = [
  { code: 'SG', name: 'Singapore', flag: '\uD83C\uDDF8\uD83C\uDDEC' },
  { code: 'TH', name: 'Thailand', flag: '\uD83C\uDDF9\uD83C\uDDED' },
  { code: 'MY', name: 'Malaysia', flag: '\uD83C\uDDF2\uD83C\uDDFE' },
  { code: 'ID', name: 'Indonesia', flag: '\uD83C\uDDEE\uD83C\uDDE9' },
  { code: 'VN', name: 'Vietnam', flag: '\uD83C\uDDFB\uD83C\uDDF3' },
  { code: 'PH', name: 'Philippines', flag: '\uD83C\uDDF5\uD83C\uDDED' },
]

function App() {
  const [adText, setAdText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [market, setMarket] = useState('SG')
  const [tone, setTone] = useState('')
  const [languageMix, setLanguageMix] = useState('')
  const [audience, setAudience] = useState('')
  const [platform, setPlatform] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [inputSnapshot, setInputSnapshot] = useState(null)
  const fileInputRef = useRef(null)

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const startTime = Date.now()
    console.log('[Pipeline] Started', { adText: adText ? `${adText.length} chars` : 'none', imageFile: imageFile?.name, market })
    setLoading(true)
    setResult(null)
    setError(null)
    setElapsed(0)

    // Snapshot the input for comparison view
    setInputSnapshot({
      type: imageFile ? 'image' : 'text',
      imagePreview: imagePreview,
      text: adText,
      market: MARKETS.find(m => m.code === market),
    })

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    const formData = new FormData()
    formData.append('market_code', market)

    if (imageFile) {
      formData.append('image', imageFile)
      setStep('Analyzing uploaded image...')
      console.log('[Pipeline] Step 1: Uploading image for analysis')
    } else if (adText.trim()) {
      formData.append('ad_text', adText)
      setStep('Processing text input...')
      console.log('[Pipeline] Step 1: Text input')
    } else {
      setError('Provide either ad text or an image')
      setLoading(false)
      clearInterval(timer)
      return
    }

    if (tone) formData.append('tone', tone)
    if (languageMix) formData.append('language_mix', languageMix)
    if (audience) formData.append('audience_segment', audience)
    if (platform) formData.append('platform', platform)
    if (notes) formData.append('freeform_notes', notes)

    const stepMessages = [
      { delay: 3000, msg: 'Analyzing ad content...', log: 'Step 1: Ad analysis' },
      { delay: 15000, msg: 'Applying market context...', log: 'Step 2-3: Market + custom' },
      { delay: 25000, msg: 'Generating localization strategy...', log: 'Step 4: Strategy' },
      { delay: 45000, msg: 'Writing localized ad copy...', log: 'Step 5a: Copy generation' },
      { delay: 65000, msg: 'Creating image direction brief...', log: 'Step 5b: Image brief' },
      { delay: 80000, msg: 'Generating localized ad image...', log: 'Step 5c: Image generation' },
    ]

    const stepTimers = stepMessages.map(({ delay, msg, log }) =>
      setTimeout(() => {
        setStep(msg)
        console.log(`[Pipeline] ${log} (${Math.floor(delay / 1000)}s)`)
      }, delay)
    )

    try {
      console.log('[Pipeline] Sending request to', `${API}/pipeline/run`)
      const resp = await fetch(`${API}/pipeline/run`, {
        method: 'POST',
        body: formData,
      })
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      console.log(`[Pipeline] Response received in ${totalTime}s, status=${resp.status}`)
      const data = await resp.json()

      if (data.status === 'ok') {
        console.log('[Pipeline] Success!', {
          steps: data.data.steps_completed,
          copies: data.data.outputs?.localized_copies?.length,
          hasImage: !!data.data.outputs?.image_url,
        })
        setResult(data.data)
        setStep('')
      } else {
        console.error('[Pipeline] Error:', data.error)
        setError(data.error || 'Pipeline failed')
      }
    } catch (err) {
      console.error('[Pipeline] Network error:', err)
      setError(`Network error: ${err.message}. Is the backend running on localhost:8000?`)
    } finally {
      setLoading(false)
      clearInterval(timer)
      stepTimers.forEach(t => clearTimeout(t))
    }
  }

  const selectedMarket = MARKETS.find(m => m.code === market)

  return (
    <div className="app">
      <header>
        <div className="logo-mark">AL</div>
        <h1>Ad Localization Engine</h1>
        <p className="subtitle">AI-powered ad localization for Southeast Asian markets</p>
      </header>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />
            <p className="loading-step">{step}</p>
            <p className="loading-elapsed">{elapsed}s elapsed</p>
            <div className="loading-bar">
              <div className="loading-bar-fill" style={{ width: `${Math.min((elapsed / 90) * 100, 95)}%` }} />
            </div>
          </div>
        </div>
      )}

      <main>
        <form onSubmit={handleSubmit} className="pipeline-form">
          {/* Step 1 */}
          <section className="form-section">
            <div className="section-header">
              <span className="step-badge">1</span>
              <div>
                <h2>Ad Input</h2>
                <p className="section-desc">Provide your ad as text or upload an image</p>
              </div>
            </div>

            <div className="input-tabs">
              <div className={`input-tab-content ${imagePreview ? 'has-preview' : ''}`}>
                <textarea
                  placeholder="Describe your ad here...&#10;&#10;Example: BobaBoss premium bubble tea. Headline: Sip the Difference. Body: Premium pearl milk tea made fresh daily. CTA: Order Now. Visual: Minimalist pastel colors. Brand: Youthful, trendy."
                  value={adText}
                  onChange={e => setAdText(e.target.value)}
                  rows={5}
                  disabled={loading || !!imageFile}
                  className={imageFile ? 'disabled-input' : ''}
                />

                <div className="divider-row">
                  <span className="divider-line" />
                  <span className="divider-text">OR</span>
                  <span className="divider-line" />
                </div>

                <div className="upload-zone" onClick={() => !loading && fileInputRef.current?.click()}>
                  {imagePreview ? (
                    <div className="preview-container">
                      <img src={imagePreview} alt="Preview" className="upload-preview" />
                      <button type="button" className="clear-btn" onClick={e => { e.stopPropagation(); clearImage() }}>Remove</button>
                    </div>
                  ) : (
                    <>
                      <div className="upload-icon">+</div>
                      <p>Click to upload an ad image</p>
                      <p className="upload-hint">PNG, JPG up to 10MB</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={loading}
                    hidden
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="form-section">
            <div className="section-header">
              <span className="step-badge">2</span>
              <div>
                <h2>Target Market</h2>
                <p className="section-desc">Select a Southeast Asian market</p>
              </div>
            </div>
            <div className="market-grid">
              {MARKETS.map(m => (
                <button
                  key={m.code}
                  type="button"
                  className={`market-btn ${market === m.code ? 'active' : ''}`}
                  onClick={() => setMarket(m.code)}
                  disabled={loading}
                >
                  <span className="market-flag">{m.flag}</span>
                  <span className="market-name">{m.name}</span>
                  <span className="market-code">{m.code}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Step 3 */}
          <section className="form-section">
            <div className="section-header">
              <span className="step-badge">3</span>
              <div>
                <h2>Custom Instructions</h2>
                <p className="section-desc">Fine-tune the localization (optional)</p>
              </div>
            </div>
            <div className="custom-grid">
              <div className="field-group">
                <label>Tone</label>
                <input placeholder="e.g., Gen-Z casual, formal, playful" value={tone} onChange={e => setTone(e.target.value)} disabled={loading} />
              </div>
              <div className="field-group">
                <label>Language Mix</label>
                <input placeholder="e.g., Singlish, Bahasa Rojak, Taglish" value={languageMix} onChange={e => setLanguageMix(e.target.value)} disabled={loading} />
              </div>
              <div className="field-group">
                <label>Audience</label>
                <input placeholder="e.g., students, working professionals" value={audience} onChange={e => setAudience(e.target.value)} disabled={loading} />
              </div>
              <div className="field-group">
                <label>Platform</label>
                <input placeholder="e.g., Instagram, TikTok, Shopee" value={platform} onChange={e => setPlatform(e.target.value)} disabled={loading} />
              </div>
            </div>
            <div className="field-group" style={{ marginTop: '0.5rem' }}>
              <label>Additional Notes</label>
              <textarea
                placeholder="Any other instructions for the localization..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                disabled={loading}
              />
            </div>
          </section>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Processing...' : 'Generate Localized Ad'}
          </button>
        </form>

        {error && (
          <div className="error-msg">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="results">
            <div className="results-header">
              <h2>Localization Results</h2>
              <span className="results-market">{inputSnapshot?.market?.flag} {inputSnapshot?.market?.name}</span>
            </div>

            {/* Comparison: Input vs Output */}
            <div className="result-section comparison-section">
              <h3>Input vs. Output Comparison</h3>
              <div className="comparison-grid">
                <div className="comparison-side">
                  <div className="comparison-label">Original Input</div>
                  {inputSnapshot?.type === 'image' && inputSnapshot.imagePreview ? (
                    <img src={inputSnapshot.imagePreview} alt="Original ad" className="comparison-image" />
                  ) : (
                    <div className="comparison-text-card">
                      <p>{inputSnapshot?.text}</p>
                    </div>
                  )}
                </div>
                <div className="comparison-arrow">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <div className="comparison-side">
                  <div className="comparison-label">Localized Output</div>
                  {result.outputs?.image_url ? (
                    <img src={result.outputs.image_url} alt="Localized ad" className="comparison-image" />
                  ) : (
                    <div className="comparison-text-card placeholder">
                      <p>Image generation unavailable</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Strategy */}
            <div className="result-section">
              <h3>Localization Strategy</h3>
              <div className="strategy-grid">
                <div className="strategy-card keep">
                  <h4>Keep</h4>
                  <ul>{result.strategy?.keep?.map((k, i) => <li key={i}>{k}</li>)}</ul>
                </div>
                <div className="strategy-card change">
                  <h4>Change</h4>
                  <ul>{result.strategy?.change?.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              </div>
              {result.strategy?.cultural_adaptations?.length > 0 && (
                <div className="strategy-card adapt">
                  <h4>Cultural Adaptations</h4>
                  <ul>{result.strategy.cultural_adaptations.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
              {result.strategy?.language_decisions && (
                <div className="strategy-card lang">
                  <h4>Language Decisions</h4>
                  <p>{result.strategy.language_decisions}</p>
                </div>
              )}
            </div>

            {/* Localized Copy */}
            <div className="result-section">
              <h3>Localized Ad Copy</h3>
              <div className="copies-grid">
                {result.outputs?.localized_copies?.map((copy, i) => (
                  <div key={i} className="copy-card">
                    <div className="copy-lang">{copy.language}</div>
                    <div className="copy-headline">{copy.headline}</div>
                    <div className="copy-body">{copy.body}</div>
                    <div className="copy-cta">{copy.cta}</div>
                    {(copy.tone_notes || copy.cultural_reasoning) && (
                      <div className="copy-meta">
                        {copy.tone_notes && <span>Tone: {copy.tone_notes}</span>}
                        {copy.cultural_reasoning && <span>Reasoning: {copy.cultural_reasoning}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Image Brief */}
            <div className="result-section">
              <h3>Image Direction Brief</h3>
              <div className="brief-content">
                <p>{result.outputs?.image_brief?.description}</p>
                {result.outputs?.image_brief?.style_notes && (
                  <div className="brief-detail">
                    <strong>Style:</strong> {result.outputs.image_brief.style_notes}
                  </div>
                )}
                {result.outputs?.image_brief?.cultural_elements?.length > 0 && (
                  <div className="brief-tags">
                    {result.outputs.image_brief.cultural_elements.map((el, i) => (
                      <span key={i} className="tag">{el}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer>
        <p>Ad Localization Engine v0.1 &middot; Powered by GMI Cloud</p>
      </footer>
    </div>
  )
}

export default App
