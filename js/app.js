$('#jobsGrid').innerHTML = visibleJobs.map((job) => `
    <article class="job-card">
      <div class="job-top">
        <span class="job-type ${job.type === 'حكومي' ? 'government' : 'private'}">${escapeHtml(job.type)}</span>
        <span class="job-date">حتى ${formatDate(job.deadline)}</span>
      </div>
      <h3>${escapeHtml(job.title)}</h3>
      <p class="company">${escapeHtml(job.company)}</p>
      <div class="job-meta">
        <span>⌖ ${escapeHtml(job.governorate)}</span>
        <span>◈ ${escapeHtml(job.field)}</span>
      </div>
      <p class="job-description">${escapeHtml(job.description)}</p>
      <div class="job-actions">
        <a href="${escapeHtml(job.source)}" target="_blank" rel="noopener noreferrer">رابط المصدر &larr;</a>
        <button class="btn-whatsapp" type="button" onclick="shareJob('${escapeHtml(job.id)}')">
          مشاركة
        </button>
      </div>
    </article>`).join('');