import { useState, useRef } from 'react'
import './App.css'

const API = 'http://localhost:8000/api/v1'

const MARKETS = [
  { code: 'SG', name: 'Singapore', flag: '\uD83C\uDDF8\uD83C\uDDEC' },
  { code: 'TH', name: 'Thailand', flag: '\uD83C\uDDF9\uD83C\uDDED' },
  { code: 'MY', name: 'Malaysia', flag: '\uD83C\uDDF2\uD83C\uDDFE' },
  { code: 'ID', name: 'Indonesia', flag: '\uD83C\uDDEE\uD83C\uDDE9' },
  { code: 'CN', name: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
  { code: 'PH', name: 'Philippines', flag: '\uD83C\uDDF5\uD83C\uDDED' },
]

function App() {
  // Mode
  const [mode, setMode] = useState('creative') // 'creative' | 'direct'

  // Shared
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [inputSnapshot, setInputSnapshot] = useState(null)
  const fileInputRef = useRef(null)

  // Creative mode
  const [adText, setAdText] = useState('')
  const [market, setMarket] = useState('SG')
  const [tone, setTone] = useState('')
  const [languageMix, setLanguageMix] = useState('')
  const [audience, setAudience] = useState('')
  const [platform, setPlatform] = useState('')
  const [notes, setNotes] = useState('')
  const [creativeResult, setCreativeResult] = useState(null)

  // Direct edit mode
  const [editInstructions, setEditInstructions] = useState('')
  const [directResult, setDirectResult] = useState(null)

  // Publishing
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)

  async function handlePublishToTikTok(imageUrl, caption) {
    setPublishing(true)
    setPublishResult(null)
    console.log('[Publish] Posting to TikTok...', { caption: caption?.slice(0, 80), imageUrl: imageUrl?.slice(0, 80) })

    try {
      const resp = await fetch(`${API}/publish/tiktok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, image_url: imageUrl }),
      })
      const data = await resp.json()
      console.log('[Publish] Response:', data)

      if (data.status === 'ok') {
        const postLink = data.data?.post_link
        setPublishResult({
          success: true,
          message: postLink ? 'Posted to TikTok!' : 'Posted to TikTok! (link may take a moment to appear)',
          link: postLink,
        })
      } else {
        setPublishResult({ success: false, message: data.error || 'Publishing failed' })
      }
    } catch (err) {
      console.error('[Publish] Error:', err)
      setPublishResult({ success: false, message: err.message })
    } finally {
      setPublishing(false)
    }
  }

  function getCreativeCaption() {
    if (!creativeResult?.outputs?.localized_copies?.length) return ''
    const copy = creativeResult.outputs.localized_copies[0]
    return `${copy.headline}\n\n${copy.body}\n\n${copy.cta}`
  }

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

  function switchMode(newMode) {
    setMode(newMode)
    setCreativeResult(null)
    setDirectResult(null)
    setError(null)
  }

  // ── Creative Pipeline ──
  async function handleCreativeSubmit(e) {
    e.preventDefault()
    const startTime = Date.now()
    console.log('[Creative] Started', { adText: adText ? `${adText.length} chars` : 'none', imageFile: imageFile?.name, market })
    setLoading(true)
    setCreativeResult(null)
    setError(null)
    setElapsed(0)

    setInputSnapshot({
      type: imageFile ? 'image' : 'text',
      imagePreview,
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
    } else if (adText.trim()) {
      formData.append('ad_text', adText)
      setStep('Processing text input...')
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
      { delay: 3000, msg: 'Analyzing ad content...' },
      { delay: 15000, msg: 'Applying market context...' },
      { delay: 25000, msg: 'Generating localization strategy...' },
      { delay: 45000, msg: 'Writing localized ad copy...' },
      { delay: 65000, msg: 'Creating image direction brief...' },
      { delay: 80000, msg: 'Generating localized ad image...' },
    ]

    const stepTimers = stepMessages.map(({ delay, msg }) =>
      setTimeout(() => setStep(msg), delay)
    )

    try {
      const resp = await fetch(`${API}/pipeline/run`, { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.status === 'ok') {
        setCreativeResult(data.data)
        setStep('')
      } else {
        setError(data.error || 'Pipeline failed')
      }
    } catch (err) {
      setError(`Network error: ${err.message}. Is the backend running?`)
    } finally {
      setLoading(false)
      clearInterval(timer)
      stepTimers.forEach(t => clearTimeout(t))
    }
  }

  // ── Direct Edit Pipeline ──
  async function handleDirectSubmit(e) {
    e.preventDefault()
    const startTime = Date.now()

    if (!imageFile) {
      setError('Upload an image to edit')
      return
    }
    if (!editInstructions.trim()) {
      setError('Describe what to change')
      return
    }

    console.log('[Direct Edit] Started', { image: imageFile.name, instructions: editInstructions })
    setLoading(true)
    setDirectResult(null)
    setError(null)
    setElapsed(0)
    setStep('Uploading image for editing...')

    setInputSnapshot({
      type: 'image',
      imagePreview,
      text: editInstructions,
    })

    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    const stepTimers = [
      setTimeout(() => setStep('Sending to image editor (GPT Image 1.5)...'), 3000),
      setTimeout(() => setStep('Applying edits to image...'), 15000),
      setTimeout(() => setStep('Rendering final image...'), 40000),
    ]

    const formData = new FormData()
    formData.append('image', imageFile)
    formData.append('instructions', editInstructions)

    try {
      const resp = await fetch(`${API}/direct-edit/run`, { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.status === 'ok') {
        setDirectResult(data.data)
        setStep('')
      } else {
        setError(data.error || 'Direct edit failed')
      }
    } catch (err) {
      setError(`Network error: ${err.message}. Is the backend running?`)
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
        <div className="logo-mark">ADapt</div>
        <h1>Localize your ads,<br /><em>beautifully.</em></h1>
        <p className="subtitle">AI-powered creative localization for Southeast Asian and Chinese markets. From strategy to final visual, in one pipeline.</p>
      </header>

      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'creative' ? 'active' : ''}`}
          onClick={() => switchMode('creative')}
          disabled={loading}
        >
          <span className="mode-icon">&#9733;</span>
          <div>
            <span className="mode-title">Creative Localization</span>
            <span className="mode-desc">Full pipeline with strategy, copy, and new image</span>
          </div>
        </button>
        <button
          className={`mode-btn ${mode === 'direct' ? 'active' : ''}`}
          onClick={() => switchMode('direct')}
          disabled={loading}
        >
          <span className="mode-icon">&#9998;</span>
          <div>
            <span className="mode-title">Direct Edit</span>
            <span className="mode-desc">Surgically swap elements on the original image</span>
          </div>
        </button>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />
            <p className="loading-step">{step}</p>
            <p className="loading-elapsed">{elapsed}s elapsed</p>
            <div className="loading-bar">
              <div className="loading-bar-fill" style={{
                width: `${Math.min((elapsed / (mode === 'direct' ? 60 : 90)) * 100, 95)}%`
              }} />
            </div>
          </div>
        </div>
      )}

      <main>
        {/* ═══ CREATIVE MODE ═══ */}
        {mode === 'creative' && (
          <>
            <form onSubmit={handleCreativeSubmit} className="pipeline-form">
              <section className="form-section">
                <div className="section-header">
                  <span className="step-badge">1</span>
                  <div>
                    <h2>Ad Input</h2>
                    <p className="section-desc">Provide your ad as text or upload an image</p>
                  </div>
                </div>

                <textarea
                  placeholder={"Describe your ad here...\n\nExample: BobaBoss premium bubble tea. Headline: Sip the Difference. Body: Premium pearl milk tea made fresh daily. CTA: Order Now."}
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
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={loading} hidden />
                </div>
              </section>

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
                    <button key={m.code} type="button" className={`market-btn ${market === m.code ? 'active' : ''}`} onClick={() => setMarket(m.code)} disabled={loading}>
                      <span className="market-flag">{m.flag}</span>
                      <span className="market-name">{m.name}</span>
                      <span className="market-code">{m.code}</span>
                    </button>
                  ))}
                </div>
              </section>

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
                    <input placeholder="e.g., Gen-Z casual, formal" value={tone} onChange={e => setTone(e.target.value)} disabled={loading} />
                  </div>
                  <div className="field-group">
                    <label>Language Mix</label>
                    <input placeholder="e.g., Singlish, Taglish" value={languageMix} onChange={e => setLanguageMix(e.target.value)} disabled={loading} />
                  </div>
                  <div className="field-group">
                    <label>Audience</label>
                    <input placeholder="e.g., students, parents" value={audience} onChange={e => setAudience(e.target.value)} disabled={loading} />
                  </div>
                  <div className="field-group">
                    <label>Platform</label>
                    <input placeholder="e.g., Instagram, TikTok" value={platform} onChange={e => setPlatform(e.target.value)} disabled={loading} />
                  </div>
                </div>
                <div className="field-group" style={{ marginTop: '0.5rem' }}>
                  <label>Additional Notes</label>
                  <textarea placeholder="Any other instructions..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} disabled={loading} />
                </div>
              </section>

              <button type="submit" className="submit-btn" disabled={loading}>
                Generate Localized Ad
              </button>
            </form>

            {/* Creative Results */}
            {creativeResult && (
              <div className="results">
                <div className="results-header">
                  <h2>Localization Results</h2>
                  <span className="results-market">{inputSnapshot?.market?.flag} {inputSnapshot?.market?.name}</span>
                </div>

                <div className="result-section comparison-section">
                  <h3>Input vs. Output Comparison</h3>
                  <div className="comparison-grid">
                    <div className="comparison-side">
                      <div className="comparison-label">Original Input</div>
                      {inputSnapshot?.type === 'image' && inputSnapshot.imagePreview ? (
                        <img src={inputSnapshot.imagePreview} alt="Original ad" className="comparison-image" />
                      ) : (
                        <div className="comparison-text-card"><p>{inputSnapshot?.text}</p></div>
                      )}
                    </div>
                    <div className="comparison-arrow">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </div>
                    <div className="comparison-side">
                      <div className="comparison-label">Localized Output</div>
                      {creativeResult.outputs?.image_url ? (
                        <img src={creativeResult.outputs.image_url} alt="Localized ad" className="comparison-image" />
                      ) : (
                        <div className="comparison-text-card placeholder"><p>Image generation unavailable</p></div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="result-section">
                  <h3>Localization Strategy</h3>
                  <div className="strategy-grid">
                    <div className="strategy-card keep">
                      <h4>Keep</h4>
                      <ul>{creativeResult.strategy?.keep?.map((k, i) => <li key={i}>{k}</li>)}</ul>
                    </div>
                    <div className="strategy-card change">
                      <h4>Change</h4>
                      <ul>{creativeResult.strategy?.change?.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  </div>
                  {creativeResult.strategy?.cultural_adaptations?.length > 0 && (
                    <div className="strategy-card adapt">
                      <h4>Cultural Adaptations</h4>
                      <ul>{creativeResult.strategy.cultural_adaptations.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </div>
                  )}
                  {creativeResult.strategy?.language_decisions && (
                    <div className="strategy-card lang">
                      <h4>Language Decisions</h4>
                      <p>{creativeResult.strategy.language_decisions}</p>
                    </div>
                  )}
                </div>

                <div className="result-section">
                  <h3>Localized Ad Copy</h3>
                  <div className="copies-grid">
                    {creativeResult.outputs?.localized_copies?.map((copy, i) => (
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

                <div className="result-section">
                  <h3>Image Direction Brief</h3>
                  <div className="brief-content">
                    <p>{creativeResult.outputs?.image_brief?.description}</p>
                    {creativeResult.outputs?.image_brief?.style_notes && (
                      <div className="brief-detail"><strong>Style:</strong> {creativeResult.outputs.image_brief.style_notes}</div>
                    )}
                    {creativeResult.outputs?.image_brief?.cultural_elements?.length > 0 && (
                      <div className="brief-tags">
                        {creativeResult.outputs.image_brief.cultural_elements.map((el, i) => <span key={i} className="tag">{el}</span>)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Publish to TikTok */}
                {creativeResult.outputs?.image_url && (
                  <div className="result-section publish-section">
                    <h3>Publish</h3>
                    <p className="publish-desc">Post the localized ad directly to TikTok</p>
                    <button
                      className="publish-btn"
                      onClick={() => handlePublishToTikTok(
                        creativeResult.outputs.image_url,
                        getCreativeCaption()
                      )}
                      disabled={publishing}
                    >
                      {publishing ? 'Publishing...' : 'Post to TikTok'}
                    </button>
                    {publishResult && (
                      <div className={`publish-result ${publishResult.success ? 'success' : 'fail'}`}>
                        {publishResult.message}
                        {publishResult.link && (
                          <a href={publishResult.link} target="_blank" rel="noopener noreferrer" className="publish-link">
                            View on TikTok
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══ DIRECT EDIT MODE ═══ */}
        {mode === 'direct' && (
          <>
            <form onSubmit={handleDirectSubmit} className="pipeline-form">
              <section className="form-section">
                <div className="section-header">
                  <span className="step-badge">1</span>
                  <div>
                    <h2>Upload Ad Image</h2>
                    <p className="section-desc">The image you want to edit</p>
                  </div>
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
                      <p>Click to upload your ad image</p>
                      <p className="upload-hint">PNG, JPG up to 10MB</p>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={loading} hidden />
                </div>
              </section>

              <section className="form-section">
                <div className="section-header">
                  <span className="step-badge">2</span>
                  <div>
                    <h2>Edit Instructions</h2>
                    <p className="section-desc">Describe exactly what to change. Be specific.</p>
                  </div>
                </div>
                <textarea
                  placeholder={"Describe the specific changes to make...\n\nExample:\n- Replace the Coca-Cola logo/text with Pokka Green Tea branding\n- Replace the Pepsi cape with Authentic Tea House Ayataka branding\n- Change the headline text to 'Kami ucapkan Halloween yang menyeramkan!'"}
                  value={editInstructions}
                  onChange={e => setEditInstructions(e.target.value)}
                  rows={6}
                  disabled={loading}
                />
              </section>

              <button type="submit" className="submit-btn submit-btn-edit" disabled={loading}>
                Apply Edits
              </button>
            </form>

            {/* Direct Edit Results */}
            {directResult && (
              <div className="results">
                <div className="results-header">
                  <h2>Edit Results</h2>
                  <span className="results-market">Direct Edit</span>
                </div>

                <div className="result-section comparison-section">
                  <h3>Before & After</h3>
                  <div className="comparison-grid">
                    <div className="comparison-side">
                      <div className="comparison-label">Original</div>
                      {inputSnapshot?.imagePreview && (
                        <img src={inputSnapshot.imagePreview} alt="Original" className="comparison-image" />
                      )}
                    </div>
                    <div className="comparison-arrow">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </div>
                    <div className="comparison-side">
                      <div className="comparison-label">Edited</div>
                      {directResult.image_url ? (
                        <img src={directResult.image_url} alt="Edited" className="comparison-image" />
                      ) : (
                        <div className="comparison-text-card placeholder"><p>Edit failed</p></div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="result-section">
                  <h3>Applied Instructions</h3>
                  <div className="brief-content">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{directResult.instructions}</p>
                  </div>
                </div>

                {/* Publish to TikTok */}
                {directResult.image_url && (
                  <div className="result-section publish-section">
                    <h3>Publish</h3>
                    <p className="publish-desc">Post the edited ad directly to TikTok</p>
                    <button
                      className="publish-btn"
                      onClick={() => handlePublishToTikTok(
                        directResult.image_url,
                        editInstructions
                      )}
                      disabled={publishing}
                    >
                      {publishing ? 'Publishing...' : 'Post to TikTok'}
                    </button>
                    {publishResult && (
                      <div className={`publish-result ${publishResult.success ? 'success' : 'fail'}`}>
                        {publishResult.message}
                        {publishResult.link && (
                          <a href={publishResult.link} target="_blank" rel="noopener noreferrer" className="publish-link">
                            View on TikTok
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {error && <div className="error-msg"><strong>Error:</strong> {error}</div>}
      </main>

      <footer>
        <p>ADapt &middot; AI-powered ad localization &middot; Powered by GMI Cloud</p>
      </footer>
    </div>
  )
}

export default App
