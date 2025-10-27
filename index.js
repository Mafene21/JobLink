// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  
  hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  });
  
  // Close mobile menu when clicking on a link
  document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
  }));
  
  // Animate elements on scroll
  const animateOnScroll = function() {
    const elements = document.querySelectorAll('.feature-card, .testimonial-card');
    
    elements.forEach(element => {
      const elementPosition = element.getBoundingClientRect().top;
      const screenPosition = window.innerHeight / 1.2;
      
      if (elementPosition < screenPosition) {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      }
    });
  };
  
  // Set initial state for animation
  document.querySelectorAll('.feature-card, .testimonial-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });
  
  // Run animation on load and scroll
  window.addEventListener('load', animateOnScroll);
  window.addEventListener('scroll', animateOnScroll);
  
  // Add smooth scrolling for anchor links
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
  
  // Stats counter animation
  const statsSection = document.querySelector('.hero-stats');
  const stats = document.querySelectorAll('.stat-number');
  let animated = false;
  
  const animateStats = function() {
    if (animated) return;
    
    const statsSectionPosition = statsSection.getBoundingClientRect().top;
    const screenPosition = window.innerHeight / 1.2;
    
    if (statsSectionPosition < screenPosition) {
      animated = true;
      
      stats.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target') || stat.textContent.replace('+', ''));
        const increment = target / 100;
        let current = 0;
        
        const updateCount = () => {
          if (current < target) {
            current += increment;
            stat.textContent = Math.ceil(current) + '+';
            setTimeout(updateCount, 20);
          } else {
            stat.textContent = target + '+';
          }
        };
        
        updateCount();
      });
    }
  };
  
  // Initialize stats with data attributes
  document.querySelectorAll('.stat-number').forEach(stat => {
    const value = stat.textContent;
    stat.setAttribute('data-target', value.replace('+', ''));
    stat.textContent = '0+';
  });
  
  window.addEventListener('scroll', animateStats);
});