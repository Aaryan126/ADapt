import { useState, useRef, useEffect } from 'react'
import './App.css'

const API = 'http://localhost:8000/api/v1'

const MARKETS = [
  { code: 'SG', name: 'Singapore', flag: '\uD83C\uDDF8\uD83C\uDDEC', lang: 'English + Mandarin, Malay, Tamil', vibe: 'Kiasu culture, Singlish wordplay, food-obsessed' },
  { code: 'TH', name: 'Thailand', flag: '\uD83C\uDDF9\uD83C\uDDED', lang: 'Thai + English', vibe: 'Land of Smiles, sanuk (fun), Buddhist values' },
  { code: 'MY', name: 'Malaysia', flag: '\uD83C\uDDF2\uD83C\uDDFE', lang: 'Bahasa Malaysia + English, Mandarin, Tamil', vibe: 'Multiracial, Bahasa Rojak, halal-conscious' },
  { code: 'ID', name: 'Indonesia', flag: '\uD83C\uDDEE\uD83C\uDDE9', lang: 'Bahasa Indonesia + Javanese, English', vibe: 'Community-first, gotong royong, 300+ ethnic groups' },
  { code: 'CN', name: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3', lang: 'Mandarin Chinese + Cantonese, English', vibe: 'Douyin/WeChat ecosystem, mianzi culture, trend-driven' },
  { code: 'PH', name: 'Philippines', flag: '\uD83C\uDDF5\uD83C\uDDED', lang: 'Filipino (Tagalog) + English, Cebuano', vibe: 'Taglish, bayanihan spirit, meme-heavy humor' },
]

function App() {
  const [mode, setMode] = useState('creative')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [inputSnapshot, setInputSnapshot] = useState(null)
  const [showValidation, setShowValidation] = useState(false)
  const fileInputRef = useRef(null)
  const resultsRef = useRef(null)

  const [adText, setAdText] = useState('')
  const [market, setMarket] = useState('SG')
  const [tone, setTone] = useState('')
  const [languageMix, setLanguageMix] = useState('')
  const [audience, setAudience] = useState('')
  const [platform, setPlatform] = useState('')
  const [notes, setNotes] = useState('')
  const [creativeResult, setCreativeResult] = useState(null)

  const [editInstructions, setEditInstructions] = useState('')
  const [directResult, setDirectResult] = useState(null)

  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)

  // Collapsible sections
  const [openSections, setOpenSections] = useState({ strategy: true, copy: true, brief: false })
  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Scroll to results when they appear
  useEffect(() => {
    if ((creativeResult || directResult) && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [creativeResult, directResult])

  async function downloadImage(url, filename) {
    try {
      const resp = await fetch(url)
      const blob = await resp.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename || 'adapt-ad.jpg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  async function handlePublishToTikTok(imageUrl, caption) {
    setPublishing(true)
    setPublishResult(null)
    try {
      const resp = await fetch(`${API}/publish/tiktok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, image_url: imageUrl }),
      })
      const data = await resp.json()
      if (data.status === 'ok') {
        const postLink = data.data?.post_link
        setPublishResult({ success: true, message: postLink ? 'Posted to TikTok!' : 'Posted! Link may take a moment to appear.', link: postLink })
      } else {
        setPublishResult({ success: false, message: data.error || 'Publishing failed' })
      }
    } catch (err) {
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
      setShowValidation(false)
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

  function switchMode(m) {
    setMode(m)
    setCreativeResult(null)
    setDirectResult(null)
    setError(null)
    setPublishResult(null)
    setShowValidation(false)
  }

  async function handleCreativeSubmit(e) {
    e.preventDefault()
    if (!imageFile && !adText.trim()) {
      setShowValidation(true)
      return
    }
    setShowValidation(false)
    const startTime = Date.now()
    setLoading(true)
    setCreativeResult(null)
    setError(null)
    setElapsed(0)
    setPublishResult(null)
    setOpenSections({ strategy: true, copy: true, brief: false })
    setInputSnapshot({ type: imageFile ? 'image' : 'text', imagePreview, text: adText, market: MARKETS.find(m => m.code === market) })
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)

    const formData = new FormData()
    formData.append('market_code', market)
    if (imageFile) { formData.append('image', imageFile); setStep('Analyzing uploaded image...') }
    else { formData.append('ad_text', adText); setStep('Processing text input...') }

    if (tone) formData.append('tone', tone)
    if (languageMix) formData.append('language_mix', languageMix)
    if (audience) formData.append('audience_segment', audience)
    if (platform) formData.append('platform', platform)
    if (notes) formData.append('freeform_notes', notes)

    const steps = [
      { delay: 3000, msg: 'Analyzing ad content...' }, { delay: 15000, msg: 'Applying market context...' },
      { delay: 25000, msg: 'Generating localization strategy...' }, { delay: 45000, msg: 'Writing localized ad copy...' },
      { delay: 65000, msg: 'Creating image direction brief...' }, { delay: 80000, msg: 'Generating localized ad image...' },
    ]
    const stepTimers = steps.map(({ delay, msg }) => setTimeout(() => setStep(msg), delay))

    try {
      const resp = await fetch(`${API}/pipeline/run`, { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.status === 'ok') { setCreativeResult(data.data); setStep('') }
      else setError(data.error || 'Pipeline failed')
    } catch (err) {
      setError(`Network error: ${err.message}`)
    } finally { setLoading(false); clearInterval(timer); stepTimers.forEach(t => clearTimeout(t)) }
  }

  async function handleDirectSubmit(e) {
    e.preventDefault()
    if (!imageFile || !editInstructions.trim()) {
      setShowValidation(true)
      return
    }
    setShowValidation(false)
    const startTime = Date.now()
    setLoading(true)
    setDirectResult(null)
    setError(null)
    setElapsed(0)
    setPublishResult(null)
    setStep('Uploading image for editing...')
    setInputSnapshot({ type: 'image', imagePreview, text: editInstructions })
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    const stepTimers = [
      setTimeout(() => setStep('Sending to image editor...'), 3000),
      setTimeout(() => setStep('Applying edits...'), 15000),
      setTimeout(() => setStep('Rendering final image...'), 40000),
    ]
    const formData = new FormData()
    formData.append('image', imageFile)
    formData.append('instructions', editInstructions)

    try {
      const resp = await fetch(`${API}/direct-edit/run`, { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.status === 'ok') { setDirectResult(data.data); setStep('') }
      else setError(data.error || 'Direct edit failed')
    } catch (err) {
      setError(`Network error: ${err.message}`)
    } finally { setLoading(false); clearInterval(timer); stepTimers.forEach(t => clearTimeout(t)) }
  }

  const outputImageUrl = mode === 'creative' ? creativeResult?.outputs?.image_url : directResult?.image_url
  const selectedMarket = MARKETS.find(m => m.code === market)

  return (
    <div className="app">
      <header>
        <div className="logo-mark">ADapt</div>
        <h1>Localize your ads,<br /><em>beautifully.</em></h1>
        <p className="subtitle">AI-powered creative localization for Southeast Asian and Chinese markets. From strategy to final visual, in one pipeline.</p>
      </header>

      {/* ── Mode Toggle ── */}
      <div className="mode-toggle">
        <button className={`mode-btn ${mode === 'creative' ? 'active' : ''}`} onClick={() => switchMode('creative')} disabled={loading}>
          <span className="mode-icon">&#9733;</span>
          <div>
            <span className="mode-title">Creative Localization</span>
            <span className="mode-desc">Full pipeline with strategy, copy, and new image</span>
          </div>
        </button>
        <button className={`mode-btn ${mode === 'direct' ? 'active' : ''}`} onClick={() => switchMode('direct')} disabled={loading}>
          <span className="mode-icon">&#9998;</span>
          <div>
            <span className="mode-title">Direct Edit</span>
            <span className="mode-desc">Surgically swap elements on the original image</span>
          </div>
        </button>
      </div>

      {/* Mode explanation */}
      <div className="mode-explainer">
        {mode === 'creative' ? (
          <p>Full AI pipeline: the model analyzes your ad, builds a cultural strategy, writes copy in each target language, and generates a new localized image from scratch.</p>
        ) : (
          <p>Upload your existing ad and describe what to change. The AI edits the image in-place, keeping the original composition, lighting, and style intact.</p>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />
            <p className="loading-step">{step}</p>
            <p className="loading-elapsed">{elapsed}s elapsed</p>
            <div className="loading-bar">
              <div className="loading-bar-fill" style={{ width: `${Math.min((elapsed / (mode === 'direct' ? 60 : 100)) * 100, 95)}%` }} />
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

                <div className={`input-wrapper ${showValidation && !adText.trim() && !imageFile ? 'has-error' : ''}`}>
                  <textarea
                    placeholder={"Describe your ad here...\n\nExample: BobaBoss premium bubble tea. Headline: Sip the Difference. Body: Premium pearl milk tea made fresh daily. CTA: Order Now."}
                    value={adText}
                    onChange={e => { setAdText(e.target.value); setShowValidation(false) }}
                    rows={5}
                    disabled={loading || !!imageFile}
                    className={imageFile ? 'disabled-input' : ''}
                  />
                  {showValidation && !adText.trim() && !imageFile && (
                    <span className="validation-hint">Please enter ad text or upload an image</span>
                  )}
                </div>

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
                    <p className="section-desc">Where should this ad land?</p>
                  </div>
                </div>
                <div className="market-grid">
                  {MARKETS.map(m => (
                    <div key={m.code} className="market-btn-wrapper">
                      <button type="button" className={`market-btn ${market === m.code ? 'active' : ''}`} onClick={() => setMarket(m.code)} disabled={loading}>
                        <span className="market-flag">{m.flag}</span>
                        <span className="market-name">{m.name}</span>
                        <span className="market-code">{m.code}</span>
                      </button>
                      <div className="market-tooltip">
                        <strong>{m.name}</strong>
                        <span className="tooltip-lang">{m.lang}</span>
                        <span className="tooltip-vibe">{m.vibe}</span>
                      </div>
                    </div>
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
                  <textarea placeholder="Specific directives, brand swaps, visual changes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} disabled={loading} />
                </div>
              </section>

              <button type="submit" className="submit-btn" disabled={loading}>
                Generate Localized Ad
              </button>
            </form>

            {/* Creative Results */}
            {creativeResult && (
              <div className="results" ref={resultsRef}>
                <div className="results-header">
                  <h2>Localization Results</h2>
                  <span className="results-market">{inputSnapshot?.market?.flag} {inputSnapshot?.market?.name}</span>
                </div>

                {/* Comparison - always visible */}
                <div className="result-section comparison-section">
                  <h3>Input vs. Output</h3>
                  <div className="comparison-grid">
                    <div className="comparison-side">
                      <div className="comparison-label">Original</div>
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
                      <div className="comparison-label accent">Localized</div>
                      {creativeResult.outputs?.image_url ? (
                        <div className="image-with-actions">
                          <img src={creativeResult.outputs.image_url} alt="Localized ad" className="comparison-image" />
                          <button className="img-download-btn" onClick={() => downloadImage(creativeResult.outputs.image_url, `adapt-${market}.jpg`)} title="Download image">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="comparison-text-card placeholder"><p>Image generation unavailable</p></div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Collapsible: Strategy */}
                <div className="result-section">
                  <button className="section-toggle" onClick={() => toggleSection('strategy')}>
                    <h3>Localization Strategy</h3>
                    <span className={`toggle-arrow ${openSections.strategy ? 'open' : ''}`}>&#9662;</span>
                  </button>
                  {openSections.strategy && (
                    <div className="section-body">
                      <div className="strategy-grid">
                        <div className="strategy-card keep"><h4>Keep</h4><ul>{creativeResult.strategy?.keep?.map((k, i) => <li key={i}>{k}</li>)}</ul></div>
                        <div className="strategy-card change"><h4>Change</h4><ul>{creativeResult.strategy?.change?.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                      </div>
                      {creativeResult.strategy?.cultural_adaptations?.length > 0 && (
                        <div className="strategy-card adapt"><h4>Cultural Adaptations</h4><ul>{creativeResult.strategy.cultural_adaptations.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
                      )}
                      {creativeResult.strategy?.language_decisions && (
                        <div className="strategy-card lang"><h4>Language Decisions</h4><p>{creativeResult.strategy.language_decisions}</p></div>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible: Copy */}
                <div className="result-section">
                  <button className="section-toggle" onClick={() => toggleSection('copy')}>
                    <h3>Localized Ad Copy</h3>
                    <span className={`toggle-arrow ${openSections.copy ? 'open' : ''}`}>&#9662;</span>
                  </button>
                  {openSections.copy && (
                    <div className="section-body">
                      <div className="copies-grid">
                        {creativeResult.outputs?.localized_copies?.map((copy, i) => (
                          <div key={i} className="copy-card">
                            <div className="copy-lang">{copy.language}</div>
                            <div className="copy-headline">{copy.headline}</div>
                            <div className="copy-body">{copy.body}</div>
                            <div className="copy-cta-text">{copy.cta}</div>
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
                  )}
                </div>

                {/* Collapsible: Image Brief */}
                <div className="result-section">
                  <button className="section-toggle" onClick={() => toggleSection('brief')}>
                    <h3>Image Direction Brief</h3>
                    <span className={`toggle-arrow ${openSections.brief ? 'open' : ''}`}>&#9662;</span>
                  </button>
                  {openSections.brief && (
                    <div className="section-body">
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
                  )}
                </div>

                {/* Publish */}
                {creativeResult.outputs?.image_url && (
                  <div className="result-section publish-section">
                    <h3>Publish</h3>
                    <div className="publish-actions">
                      <button className="publish-btn" onClick={() => downloadImage(creativeResult.outputs.image_url, `adapt-${market}.jpg`)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        Download Image
                      </button>
                      <button className="publish-btn publish-btn-tiktok" onClick={() => handlePublishToTikTok(creativeResult.outputs.image_url, getCreativeCaption())} disabled={publishing}>
                        {publishing ? 'Publishing...' : 'Post to TikTok'}
                      </button>
                    </div>
                    {publishResult && (
                      <div className={`publish-result ${publishResult.success ? 'success' : 'fail'}`}>
                        {publishResult.message}
                        {publishResult.link && <a href={publishResult.link} target="_blank" rel="noopener noreferrer" className="publish-link">View on TikTok</a>}
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

                <div className={`upload-zone ${showValidation && !imageFile ? 'has-error' : ''}`} onClick={() => !loading && fileInputRef.current?.click()}>
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
                {showValidation && !imageFile && <span className="validation-hint">Please upload an image</span>}
              </section>

              <section className="form-section">
                <div className="section-header">
                  <span className="step-badge">2</span>
                  <div>
                    <h2>Edit Instructions</h2>
                    <p className="section-desc">Describe exactly what to change. Be specific.</p>
                  </div>
                </div>
                <div className={`input-wrapper ${showValidation && !editInstructions.trim() ? 'has-error' : ''}`}>
                  <textarea
                    placeholder={"Describe the specific changes...\n\nExample:\n- Replace the Coca-Cola logo with Pokka Green Tea branding\n- Change the headline to Thai language\n- Swap the Pepsi cape with Ayataka branding"}
                    value={editInstructions}
                    onChange={e => { setEditInstructions(e.target.value); setShowValidation(false) }}
                    rows={6}
                    disabled={loading}
                  />
                  {showValidation && !editInstructions.trim() && <span className="validation-hint">Please describe what to change</span>}
                </div>
              </section>

              <button type="submit" className="submit-btn submit-btn-edit" disabled={loading}>
                Apply Edits
              </button>
            </form>

            {/* Direct Edit Results */}
            {directResult && (
              <div className="results" ref={resultsRef}>
                <div className="results-header">
                  <h2>Edit Results</h2>
                  <span className="results-market">Direct Edit</span>
                </div>

                <div className="result-section comparison-section">
                  <h3>Before & After</h3>
                  <div className="comparison-grid">
                    <div className="comparison-side">
                      <div className="comparison-label">Before</div>
                      {inputSnapshot?.imagePreview && <img src={inputSnapshot.imagePreview} alt="Before" className="comparison-image" />}
                    </div>
                    <div className="comparison-arrow">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </div>
                    <div className="comparison-side">
                      <div className="comparison-label accent">After</div>
                      {directResult.image_url ? (
                        <div className="image-with-actions">
                          <img src={directResult.image_url} alt="After" className="comparison-image" />
                          <button className="img-download-btn" onClick={() => downloadImage(directResult.image_url, 'adapt-edit.jpg')} title="Download image">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="comparison-text-card placeholder"><p>Edit failed</p></div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="result-section">
                  <h3>Applied Changes</h3>
                  <div className="brief-content">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{directResult.instructions}</p>
                  </div>
                </div>

                {directResult.image_url && (
                  <div className="result-section publish-section">
                    <h3>Publish</h3>
                    <div className="publish-actions">
                      <button className="publish-btn" onClick={() => downloadImage(directResult.image_url, 'adapt-edit.jpg')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                        Download Image
                      </button>
                      <button className="publish-btn publish-btn-tiktok" onClick={() => handlePublishToTikTok(directResult.image_url, editInstructions)} disabled={publishing}>
                        {publishing ? 'Publishing...' : 'Post to TikTok'}
                      </button>
                    </div>
                    {publishResult && (
                      <div className={`publish-result ${publishResult.success ? 'success' : 'fail'}`}>
                        {publishResult.message}
                        {publishResult.link && <a href={publishResult.link} target="_blank" rel="noopener noreferrer" className="publish-link">View on TikTok</a>}
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
