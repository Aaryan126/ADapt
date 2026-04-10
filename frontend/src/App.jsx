import { useState, useRef, useEffect } from 'react'
import './App.css'

const API = 'http://localhost:8000/api/v1'

const MARKETS = [
  { code: 'SG', name: 'Singapore', flag: '\uD83C\uDDF8\uD83C\uDDEC', lang: 'English + Mandarin, Malay, Tamil', vibe: 'Kiasu culture, Singlish wordplay, food-obsessed' },
  { code: 'TH', name: 'Thailand', flag: '\uD83C\uDDF9\uD83C\uDDED', lang: 'Thai + English', vibe: 'Land of Smiles, sanuk (fun), Buddhist values' },
  { code: 'MY', name: 'Malaysia', flag: '\uD83C\uDDF2\uD83C\uDDFE', lang: 'Malay + English, Mandarin, Tamil', vibe: 'Multiracial, Bahasa Rojak, halal-conscious' },
  { code: 'ID', name: 'Indonesia', flag: '\uD83C\uDDEE\uD83C\uDDE9', lang: 'Bahasa Indonesia + Javanese, English', vibe: 'Community-first, gotong royong, 300+ ethnic groups' },
  { code: 'CN', name: 'China', flag: '\uD83C\uDDE8\uD83C\uDDF3', lang: 'Mandarin + Cantonese, English', vibe: 'Douyin/WeChat ecosystem, mianzi culture' },
  { code: 'PH', name: 'Philippines', flag: '\uD83C\uDDF5\uD83C\uDDED', lang: 'Filipino + English, Cebuano', vibe: 'Taglish, bayanihan spirit, meme-heavy humor' },
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
  const [openSections, setOpenSections] = useState({ strategy: true, copy: true, brief: false })

  function toggleSection(key) { setOpenSections(prev => ({ ...prev, [key]: !prev[key] })) }

  useEffect(() => {
    if ((creativeResult || directResult) && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [creativeResult, directResult])

  function loadMockResults() {
    const mockImage = '/mock-output.png'
    setInputSnapshot({
      type: 'image',
      imagePreview: '/mock-original.jpg',
      text: 'BobaBoss premium bubble tea. Sip the Difference.',
      market: MARKETS.find(m => m.code === market),
    })
    if (mode === 'creative') {
      setCreativeResult({
        strategy: {
          keep: ['Coca-Cola branding and red color palette, universally recognized', 'Festive, joyful tone, aligns with Singapore\'s celebration culture', 'Product-forward composition with the bottle as hero element', 'Sparkling visual effects and warm lighting create premium feel'],
          change: ['Polar bear replaced with a white Merlion to reflect Singapore\'s national icon', 'Add Marina Bay Sands skyline silhouette in the background', 'Headline translated to Mandarin: "\u4eab\u7528 Coca-Cola"', 'Include subtle CNY/National Day festive elements depending on season'],
          cultural_adaptations: ['Merlion is the most recognized symbol of Singapore, instantly localizes the ad', 'Red color palette works double duty: Coca-Cola brand + auspicious color in Chinese culture', 'Avoid showing the animal drinking or eating, keep it as a mascot holding the product', 'Include "Zero Sugar" label prominently as health-conscious messaging resonates strongly in SG'],
          language_decisions: 'Primary: Mandarin headline with English brand name preserved. The Mandarin "\u4eab\u7528" (enjoy) mirrors the English "Enjoy" tagline. Secondary: English body copy for the multiracial audience. No Singlish needed here as this is a premium brand ad, not casual content.',
        },
        outputs: {
          image_url: mockImage,
          localized_copies: [
            { language: 'English (Singapore)', headline: 'Enjoy the Moment, Share the Joy', body: 'Nothing beats an ice-cold Coca-Cola on a sunny Singapore day. Whether you\'re at the hawker centre or catching the fireworks at Marina Bay, every sip brings people together. Zero Sugar, full taste.', cta: 'Grab yours at FairPrice today', tone_notes: 'Warm, celebratory, premium but approachable', cultural_reasoning: 'References shared experiences (hawker culture, Marina Bay) that resonate across all demographics in Singapore' },
            { language: 'Mandarin (\u7B80\u4F53)', headline: '\u4eab\u7528\u7f8e\u597d\u65f6\u523b\uFF0C\u5206\u4eab\u5feb\u4e50', body: '\u5728\u65b0\u52a0\u5761\u7684\u8273\u9633\u4e0b\uFF0C\u6ca1\u6709\u4ec0\u4e48\u6bd4\u4e00\u7f50\u51b0\u51c9\u7684\u53ef\u53e3\u53ef\u4e50\u66f4\u723d\u5feb\u3002\u65e0\u8bba\u662f\u5728\u719f\u98df\u4e2d\u5fc3\u8fd8\u662f\u6ee8\u6d77\u6e7e\u770b\u70df\u82b1\uFF0c\u6bcf\u4e00\u53e3\u90fd\u8ba9\u4eba\u4eec\u8d70\u5f97\u66f4\u8fd1\u3002\u96f6\u7cd6\uFF0c\u6ee1\u5206\u53e3\u611f\u3002', cta: '\u4eca\u5929\u5c31\u5230 FairPrice \u8d2d\u4e70', tone_notes: 'Polished, aspirational Mandarin suitable for print and digital', cultural_reasoning: 'Preserves the "Enjoy" tagline in Mandarin, references local landmarks, positions as a shared social experience' },
          ],
          image_brief: {
            description: 'The original polar bear is replaced by a majestic white Merlion, Singapore\'s iconic half-lion half-fish statue, holding a Coca-Cola bottle in the same pose. The background shifts from a generic winter scene to a warm, festive red backdrop with the Marina Bay Sands skyline subtly visible through sparkling bokeh lights. The Merlion has a friendly, approachable expression. The Coca-Cola bottle remains identical with condensation droplets. The "Enjoy Coca-Cola" text is rendered in Mandarin characters "\u4eab\u7528" above the English logo. The overall mood is celebratory and premium.',
            cultural_elements: ['Merlion as national mascot', 'Marina Bay Sands skyline', 'Red and gold color accents (auspicious)', 'Mandarin headline typography'],
          },
        },
      })
    } else {
      setDirectResult({
        image_url: mockImage,
        instructions: 'Replace Coca-Cola branding with Pokka Green Tea.\nReplace Pepsi cape with Ayataka branding.\nKeep everything else identical.',
      })
    }
  }

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
    } catch (err) { console.error('Download failed:', err) }
  }

  async function handlePublishToTikTok(imageUrl, caption) {
    setPublishing(true); setPublishResult(null)
    try {
      const resp = await fetch(`${API}/publish/tiktok`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption, image_url: imageUrl }) })
      const data = await resp.json()
      if (data.status === 'ok') { setPublishResult({ success: true, message: data.data?.post_link ? 'Posted to TikTok!' : 'Posted! Link may take a moment.', link: data.data?.post_link }) }
      else { setPublishResult({ success: false, message: data.error || 'Publishing failed' }) }
    } catch (err) { setPublishResult({ success: false, message: err.message }) }
    finally { setPublishing(false) }
  }

  function getCreativeCaption() {
    if (!creativeResult?.outputs?.localized_copies?.length) return ''
    const c = creativeResult.outputs.localized_copies[0]
    return `${c.headline}\n\n${c.body}\n\n${c.cta}`
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (file) { setImageFile(file); setShowValidation(false); const r = new FileReader(); r.onloadend = () => setImagePreview(r.result); r.readAsDataURL(file) }
  }

  function clearImage() { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }
  function switchMode(m) { setMode(m); setCreativeResult(null); setDirectResult(null); setError(null); setPublishResult(null); setShowValidation(false) }

  async function handleCreativeSubmit(e) {
    e.preventDefault()
    if (!imageFile && !adText.trim()) { setShowValidation(true); return }
    setShowValidation(false)
    const startTime = Date.now()
    setLoading(true); setCreativeResult(null); setError(null); setElapsed(0); setPublishResult(null)
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
    const steps = [{ delay: 3000, msg: 'Analyzing ad content...' }, { delay: 15000, msg: 'Applying market context...' }, { delay: 25000, msg: 'Generating strategy...' }, { delay: 45000, msg: 'Writing localized copy...' }, { delay: 65000, msg: 'Creating image brief...' }, { delay: 80000, msg: 'Generating ad image...' }]
    const stepTimers = steps.map(({ delay, msg }) => setTimeout(() => setStep(msg), delay))
    try {
      const resp = await fetch(`${API}/pipeline/run`, { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.status === 'ok') { setCreativeResult(data.data); setStep('') } else setError(data.error || 'Pipeline failed')
    } catch (err) { setError(`Network error: ${err.message}`) }
    finally { setLoading(false); clearInterval(timer); stepTimers.forEach(t => clearTimeout(t)) }
  }

  async function handleDirectSubmit(e) {
    e.preventDefault()
    if (!imageFile || !editInstructions.trim()) { setShowValidation(true); return }
    setShowValidation(false)
    const startTime = Date.now()
    setLoading(true); setDirectResult(null); setError(null); setElapsed(0); setPublishResult(null); setStep('Uploading image...')
    setInputSnapshot({ type: 'image', imagePreview, text: editInstructions })
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    const stepTimers = [setTimeout(() => setStep('Sending to editor...'), 3000), setTimeout(() => setStep('Applying edits...'), 15000), setTimeout(() => setStep('Rendering...'), 40000)]
    const formData = new FormData(); formData.append('image', imageFile); formData.append('instructions', editInstructions)
    try {
      const resp = await fetch(`${API}/direct-edit/run`, { method: 'POST', body: formData })
      const data = await resp.json()
      if (data.status === 'ok') { setDirectResult(data.data); setStep('') } else setError(data.error || 'Edit failed')
    } catch (err) { setError(`Network error: ${err.message}`) }
    finally { setLoading(false); clearInterval(timer); stepTimers.forEach(t => clearTimeout(t)) }
  }

  const outputImageUrl = mode === 'creative' ? creativeResult?.outputs?.image_url : directResult?.image_url
  const hasResults = !!(creativeResult || directResult)

  return (
    <div className="app">
      {/* ── Top Bar ── */}
      <div className="topbar">
        <div className="topbar-brand">
          <span className="brand-text">ADapt</span>
        </div>
        <div className="topbar-modes">
          <button className={`topbar-tab ${mode === 'creative' ? 'active' : ''}`} onClick={() => switchMode('creative')} disabled={loading}>Creative Localization</button>
          <button className={`topbar-tab ${mode === 'direct' ? 'active' : ''}`} onClick={() => switchMode('direct')} disabled={loading}>Direct Edit</button>
        </div>
        <div className="topbar-right">
          {loading && <span className="topbar-status"><span className="status-dot" />{step} ({elapsed}s)</span>}
          <button className="preview-btn" onClick={loadMockResults}>Preview</button>
        </div>
      </div>

      {/* ── Loading bar ── */}
      {loading && (
        <div className="global-loader">
          <div className="global-loader-fill" style={{ width: `${Math.min((elapsed / (mode === 'direct' ? 60 : 100)) * 100, 95)}%` }} />
        </div>
      )}

      {error && <div className="error-bar">{error}</div>}

      {/* ═══════ CREATIVE MODE ═══════ */}
      {mode === 'creative' && !hasResults && (
        <form onSubmit={handleCreativeSubmit} className="dashboard">
          {/* Main input - large tile */}
          <div className="tile tile-input">
            <div className="tile-label">Ad Input</div>
            <div className="upload-zone" onClick={() => !loading && !imageFile && fileInputRef.current?.click()}>
              {imagePreview ? (
                <div className="preview-wrap">
                  <img src={imagePreview} alt="Preview" className="upload-preview" />
                  <button type="button" className="clear-btn" onClick={e => { e.stopPropagation(); clearImage() }}>Remove</button>
                </div>
              ) : (
                <div className="upload-empty">
                  <div className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  </div>
                  <span>Upload ad image</span>
                  <span className="upload-sub">or drag and drop</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={loading} hidden />
            </div>
            {!imageFile && (
              <>
                <div className="tile-divider"><span>or describe it</span></div>
                <textarea placeholder={"Describe your ad here...\nProduct, headline, body copy, CTA, visual style"} value={adText} onChange={e => { setAdText(e.target.value); setShowValidation(false) }} rows={3} disabled={loading} />
              </>
            )}
            {showValidation && !adText.trim() && !imageFile && <span className="validation-hint">Provide an image or text description</span>}
          </div>

          {/* Market selector - right top */}
          <div className="tile tile-market">
            <div className="tile-label">Target Market</div>
            <div className="market-pills">
              {MARKETS.map(m => (
                <div key={m.code} className="pill-wrap">
                  <button type="button" className={`market-pill ${market === m.code ? 'active' : ''}`} onClick={() => setMarket(m.code)} disabled={loading}>
                    <span className="pill-flag">{m.flag}</span>
                    <span className="pill-name">{m.name}</span>
                  </button>
                  <div className="pill-tooltip">
                    <strong>{m.name}</strong>
                    <span className="tt-lang">{m.lang}</span>
                    <span className="tt-vibe">{m.vibe}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom instructions - right bottom */}
          <div className="tile tile-instructions">
            <div className="tile-label">Custom Instructions <span className="optional-tag">Optional</span></div>
            <div className="instr-grid">
              <input placeholder="Tone: Casual, Formal, Gen-Z slang, Playful..." value={tone} onChange={e => setTone(e.target.value)} disabled={loading} />
              <input placeholder="Language: Singlish, Bahasa Rojak, Taglish, Mandarin..." value={languageMix} onChange={e => setLanguageMix(e.target.value)} disabled={loading} />
              <input placeholder="Audience: Students, Parents, Young professionals..." value={audience} onChange={e => setAudience(e.target.value)} disabled={loading} />
              <input placeholder="Platform: Instagram, TikTok, Shopee, Grab Ads..." value={platform} onChange={e => setPlatform(e.target.value)} disabled={loading} />
            </div>
            <textarea placeholder="Additional notes: e.g., Replace Coca-Cola with a local brand, keep the Halloween theme, add halal certification..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} disabled={loading} />
          </div>

          {/* Generate button - full width bottom */}
          <div className="tile tile-action">
            <button type="submit" className="gen-btn" disabled={loading}>
              {loading ? `${step} (${elapsed}s)` : 'Generate Localized Ad'}
            </button>
          </div>
        </form>
      )}

      {/* ═══════ CREATIVE RESULTS ═══════ */}
      {mode === 'creative' && creativeResult && (
        <div className="results-dashboard" ref={resultsRef}>
          <button className="back-btn" onClick={() => setCreativeResult(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            New generation
          </button>

          {/* Top row: comparison */}
          <div className="results-grid">
            <div className="rtile rtile-original">
              <div className="rtile-label">Original</div>
              {inputSnapshot?.type === 'image' && inputSnapshot.imagePreview ? (
                <img src={inputSnapshot.imagePreview} alt="Original" className="rtile-img" />
              ) : (
                <div className="rtile-text">{inputSnapshot?.text}</div>
              )}
            </div>

            <div className="rtile rtile-output">
              <div className="rtile-label accent">Localized &middot; {inputSnapshot?.market?.flag} {inputSnapshot?.market?.name}</div>
              {creativeResult.outputs?.image_url ? (
                <div className="img-hover-wrap">
                  <img src={creativeResult.outputs.image_url} alt="Localized" className="rtile-img" />
                  <div className="img-overlay">
                    <button onClick={() => downloadImage(creativeResult.outputs.image_url, `adapt-${market}.jpg`)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                      Download
                    </button>
                    <button className="tiktok-btn" onClick={() => handlePublishToTikTok(creativeResult.outputs.image_url, getCreativeCaption())} disabled={publishing}>
                      {publishing ? 'Posting...' : 'TikTok'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rtile-text dim">No image generated</div>
              )}
              {publishResult && (
                <div className={`pub-msg ${publishResult.success ? 'ok' : 'err'}`}>
                  {publishResult.message}
                  {publishResult.link && <a href={publishResult.link} target="_blank" rel="noopener noreferrer">View</a>}
                </div>
              )}
            </div>

            <div className="rtile rtile-strategy">
              <button className="section-toggle" onClick={() => toggleSection('strategy')}>
                <span className="rtile-label">Strategy</span>
                <span className={`toggle-arrow ${openSections.strategy ? 'open' : ''}`}>&#9662;</span>
              </button>
              {openSections.strategy && (
                <div className="strat-body">
                  <div className="strat-group">
                    <h4 className="strat-keep">Keep</h4>
                    <ul>{creativeResult.strategy?.keep?.map((k, i) => <li key={i}>{k}</li>)}</ul>
                  </div>
                  <div className="strat-group">
                    <h4 className="strat-change">Change</h4>
                    <ul>{creativeResult.strategy?.change?.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </div>
                  {creativeResult.strategy?.cultural_adaptations?.length > 0 && (
                    <div className="strat-group">
                      <h4 className="strat-adapt">Adaptations</h4>
                      <ul>{creativeResult.strategy.cultural_adaptations.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </div>
                  )}
                  {creativeResult.strategy?.language_decisions && (
                    <div className="strat-group">
                      <h4 className="strat-lang">Language</h4>
                      <p>{creativeResult.strategy.language_decisions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Copy cards */}
          <div className="rtile rtile-copy">
            <button className="section-toggle" onClick={() => toggleSection('copy')}>
              <span className="rtile-label">Localized Copy</span>
              <span className={`toggle-arrow ${openSections.copy ? 'open' : ''}`}>&#9662;</span>
            </button>
            {openSections.copy && (
              <div className="copy-row">
                {creativeResult.outputs?.localized_copies?.map((copy, i) => (
                  <div key={i} className="copy-card">
                    <span className="copy-lang">{copy.language}</span>
                    <div className="copy-hl">{copy.headline}</div>
                    <div className="copy-bd">{copy.body}</div>
                    <span className="copy-cta">{copy.cta}</span>
                    {copy.cultural_reasoning && <p className="copy-why">{copy.cultural_reasoning}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Brief */}
          <div className="rtile rtile-brief">
            <button className="section-toggle" onClick={() => toggleSection('brief')}>
              <span className="rtile-label">Image Brief</span>
              <span className={`toggle-arrow ${openSections.brief ? 'open' : ''}`}>&#9662;</span>
            </button>
            {openSections.brief && (
              <div className="brief-body">
                <p>{creativeResult.outputs?.image_brief?.description}</p>
                {creativeResult.outputs?.image_brief?.cultural_elements?.length > 0 && (
                  <div className="brief-tags">{creativeResult.outputs.image_brief.cultural_elements.map((el, i) => <span key={i} className="tag">{el}</span>)}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ DIRECT EDIT MODE ═══════ */}
      {mode === 'direct' && !directResult && (
        <form onSubmit={handleDirectSubmit} className="dashboard dashboard-direct">
          <div className="tile tile-input">
            <div className="tile-label">Source Image</div>
            <div className={`upload-zone ${showValidation && !imageFile ? 'has-error' : ''}`} onClick={() => !loading && !imageFile && fileInputRef.current?.click()}>
              {imagePreview ? (
                <div className="preview-wrap">
                  <img src={imagePreview} alt="Preview" className="upload-preview" />
                  <button type="button" className="clear-btn" onClick={e => { e.stopPropagation(); clearImage() }}>Remove</button>
                </div>
              ) : (
                <div className="upload-empty">
                  <div className="upload-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  </div>
                  <span>Upload image to edit</span>
                  <span className="upload-sub">PNG, JPG up to 10MB</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={loading} hidden />
            </div>
            {showValidation && !imageFile && <span className="validation-hint">Please upload an image</span>}
          </div>

          <div className="tile tile-edit-instructions">
            <div className="tile-label">Edit Instructions</div>
            <textarea
              placeholder={"Describe exact changes...\n\n- Replace Coca-Cola with Pokka Green Tea\n- Change headline to Thai\n- Swap Pepsi cape with Ayataka"}
              value={editInstructions}
              onChange={e => { setEditInstructions(e.target.value); setShowValidation(false) }}
              rows={8}
              disabled={loading}
            />
            {showValidation && !editInstructions.trim() && <span className="validation-hint">Describe what to change</span>}
          </div>

          <div className="tile tile-action">
            <button type="submit" className="gen-btn gen-btn-edit" disabled={loading}>
              {loading ? `${step} (${elapsed}s)` : 'Apply Edits'}
            </button>
          </div>
        </form>
      )}

      {/* ═══════ DIRECT EDIT RESULTS ═══════ */}
      {mode === 'direct' && directResult && (
        <div className="results-dashboard" ref={resultsRef}>
          <button className="back-btn" onClick={() => setDirectResult(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            New edit
          </button>

          <div className="results-grid results-grid-direct">
            <div className="rtile rtile-original">
              <div className="rtile-label">Before</div>
              {inputSnapshot?.imagePreview && <img src={inputSnapshot.imagePreview} alt="Before" className="rtile-img" />}
            </div>

            <div className="rtile rtile-output">
              <div className="rtile-label accent">After</div>
              {directResult.image_url ? (
                <div className="img-hover-wrap">
                  <img src={directResult.image_url} alt="After" className="rtile-img" />
                  <div className="img-overlay">
                    <button onClick={() => downloadImage(directResult.image_url, 'adapt-edit.jpg')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                      Download
                    </button>
                    <button className="tiktok-btn" onClick={() => handlePublishToTikTok(directResult.image_url, editInstructions)} disabled={publishing}>
                      {publishing ? 'Posting...' : 'TikTok'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rtile-text dim">Edit failed</div>
              )}
              {publishResult && (
                <div className={`pub-msg ${publishResult.success ? 'ok' : 'err'}`}>
                  {publishResult.message}
                  {publishResult.link && <a href={publishResult.link} target="_blank" rel="noopener noreferrer">View</a>}
                </div>
              )}
            </div>

            <div className="rtile rtile-strategy">
              <span className="rtile-label">Applied Changes</span>
              <p className="edit-instructions-text">{directResult.instructions}</p>
            </div>
          </div>
        </div>
      )}

      <footer>
        <p>ADapt &middot; Powered by GMI Cloud</p>
      </footer>
    </div>
  )
}

export default App
