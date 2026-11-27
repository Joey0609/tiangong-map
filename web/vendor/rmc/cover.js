// From Rocket Mission Control's ensureTelemetryCoverLayers (MIT).
export function ensureTelemetryCoverLayers() {
  for (const sideName of ['left','right']) {
    const side = document.querySelector(`.timeline-side-${sideName}`);
    if (!side || side.querySelector('.timeline-side-cover')) continue;
    const gradientId = `telemetryCoverGradient-${sideName}`;
    const isRight = sideName === 'right';
    const transform = isRight ? 'translate(600 0) scale(-1 1)' : '';
    const foldRadius = 30, foldInset = 372;
    side.insertAdjacentHTML('afterbegin', `
      <svg class="timeline-side-cover ${isRight ? 'is-right' : 'is-left'}" viewBox="0 0 600 180" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="black" stop-opacity="0.5"></stop>
          <stop offset="30%" stop-color="black" stop-opacity="0.3"></stop>
          <stop offset="70%" stop-color="black" stop-opacity="0.01"></stop>
          <stop offset="100%" stop-color="black" stop-opacity="0"></stop>
        </linearGradient></defs>
        <path d="M 0 0 L ${foldInset-foldRadius} 0 Q ${foldInset} 0 ${foldInset+foldRadius*0.7} ${foldRadius*0.7} L 550 180 L 0 180 Z" fill="url(#${gradientId})" transform="${transform}"></path>
      </svg>`);
  }
}
