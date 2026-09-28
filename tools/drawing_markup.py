"""Small moving pieces cut from the original ink drawings."""
def drawing(name):
 heights={'records':366,'bookshelf':366,'places':276,'films':352}
 if name not in heights:return ''
 h=heights[name]; prefix='drawing-'+name
 image=f'<image href="assets/drawings/{name}-supplied.png" width="400" height="{h}"/>'
 defs='';body=image
 if name=='records':
  defs=f'<clipPath id="{prefix}-disc"><ellipse cx="185" cy="198" rx="114" ry="116"/></clipPath><mask id="{prefix}-base"><rect width="400" height="366" fill="white"/><ellipse cx="185" cy="198" rx="114" ry="116" fill="black"/><path d="M308 61 L339 64 Q354 143 299 257 L267 246 Q323 147 308 61Z" fill="black"/></mask><clipPath id="{prefix}-arm"><path d="M308 61 L339 64 Q354 143 299 257 L267 246 Q323 147 308 61Z" fill="black"/></clipPath>'
  body=f'<g mask="url(#{prefix}-base)">{image}</g><g class="record-disc"><g clip-path="url(#{prefix}-disc)">{image}</g></g><g class="record-arm"><g clip-path="url(#{prefix}-arm)">{image}</g></g>'
 elif name=='bookshelf':
  shape='M206 166 L225 169 L207 231 L190 228 Z'
  defs=f'<mask id="{prefix}-base"><rect width="400" height="366" fill="white"/><path d="{shape}" fill="black"/></mask><clipPath id="{prefix}-book"><path d="{shape}"/></clipPath>'
  body=f'<g mask="url(#{prefix}-base)">{image}</g><g class="falling-book"><g clip-path="url(#{prefix}-book)">{image}</g></g>'
 elif name=='places':
  body+= '<g class="waterfall" fill="none" stroke="#776b56" stroke-width="1" opacity=".6"><path d="M64 142 Q69 171 66 204 T76 234"/><path d="M69 140 Q76 173 72 196 T79 228"/><path d="M73 147 Q79 175 78 198"/></g><g class="mountain-cloud" fill="none" stroke="#776b56" stroke-width=".8" opacity=".45"><path d="M184 43 Q176 36 185 32 Q187 23 198 28 Q206 18 216 29 Q229 26 230 36 Q243 39 233 44 Q210 47 184 43Z"/><path d="M191 48 Q211 51 230 47"/></g>'
 elif name=='films':
  defs=f'<filter id="{prefix}-noise"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="1" seed="9"/><feColorMatrix type="saturate" values="0"/></filter><clipPath id="{prefix}-screen"><path d="M75 124 Q136 108 239 123 L245 241 Q149 251 67 237Z"/></clipPath>'
  body+=f'<g clip-path="url(#{prefix}-screen)"><g class="tv-static" opacity=".18"><rect x="45" y="90" width="230" height="190" filter="url(#{prefix}-noise)"/></g><path class="tv-scan" d="M60 154 H250 M60 157 H250" stroke="#716754" opacity=".2"/><path class="tv-flicker" d="M60 112H255V250H60Z" fill="#756b59"/></g>'
 defs += f'<filter id="{prefix}-ink" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .22 0 0 0 0 .20 0 0 0 0 .16 -1 -1 -1 2.45 0"/></filter>'
 body = f'<g filter="url(#{prefix}-ink)">{body}</g>'
 return f'<svg class="living-drawing {name}-drawing" viewBox="0 0 400 {h}" aria-hidden="true" focusable="false"><defs>{defs}</defs>{body}</svg>'
