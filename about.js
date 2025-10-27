// About Page Specific JavaScript
document.addEventListener('DOMContentLoaded', function() {
  // Animate mission stats on scroll
  const missionStats = document.querySelector('.mission-stats');
  const stats = document.querySelectorAll('.mission-stat .stat-number');
  let statsAnimated = false;
  
  const animateMissionStats = function() {
    if (statsAnimated) return;
    
    const missionStatsPosition = missionStats.getBoundingClientRect().top;
    const screenPosition = window.innerHeight / 1.2;
    
    if (missionStatsPosition < screenPosition) {
      statsAnimated = true;
      
      stats.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        const increment = target / 50;
        let current = 0;
        
        const updateCount = () => {
          if (current < target) {
            current += increment;
            stat.textContent = Math.ceil(current) + (stat.textContent.includes('%') ? '%' : 'x');
            setTimeout(updateCount, 30);
          } else {
            stat.textContent = target + (stat.textContent.includes('%') ? '%' : 'x');
          }
        };
        
        updateCount();
      });
    }
  };
  
  // Initialize mission stats with data attributes
  document.querySelectorAll('.mission-stat .stat-number').forEach(stat => {
    const value = stat.textContent;
    stat.setAttribute('data-target', value.replace(/[%x]/g, ''));
    stat.textContent = '0' + (value.includes('%') ? '%' : value.includes('x') ? 'x' : '');
  });
  
  // Team member hover effects
  const teamMembers = document.querySelectorAll('.team-member');
  
  teamMembers.forEach(member => {
    member.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-10px)';
      this.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.15)';
    });
    
    member.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(-5px)';
      this.style.boxShadow = 'var(--shadow)';
    });
  });
  
  // Value cards animation on scroll
  const valueCards = document.querySelectorAll('.value-card');
  
  const animateValueCards = function() {
    valueCards.forEach((card, index) => {
      const cardPosition = card.getBoundingClientRect().top;
      const screenPosition = window.innerHeight / 1.3;
      
      if (cardPosition < screenPosition) {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }
    });
  };
  
  // Set initial state for value cards animation
  valueCards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });
  
  // Run animations on load and scroll
  window.addEventListener('load', function() {
    animateMissionStats();
    animateValueCards();
  });
  
  window.addEventListener('scroll', function() {
    animateMissionStats();
    animateValueCards();
  });
  
  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: 'smooth'
        });
      }
    });
  });
});