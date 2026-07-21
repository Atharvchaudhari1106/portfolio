// ============================================
// PORTFOLIO - Main JavaScript
// ============================================

// Force scroll restoration to manual
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Aggressive Scroll Reset - Force y=0 repeatedly for 1000ms
const resetScroll = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
};

// Execute immediately and on every animation frame for the first second
const startTimestamp = Date.now();
const performReset = () => {
    resetScroll();
    if (Date.now() - startTimestamp < 1000) {
        requestAnimationFrame(performReset);
    } else {
        // Re-enable smooth scrolling only after stabilization
        document.documentElement.classList.add('smooth-scroll');
    }
};
requestAnimationFrame(performReset);

// Clear hash fragments to prevent jumping
if (window.location.hash) {
    history.replaceState(null, null, window.location.pathname + window.location.search);
}

document.addEventListener('DOMContentLoaded', function () {
    resetScroll();
    
    // Ensure body is visible now that we've locked the scroll
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';




    // Background Particles (Starfield) - REMOVED ANIMATION
    const particleContainer = document.getElementById('bgParticles');
    // Static background is now handled purely via CSS to remove JS overhead

    // ----------------------------------------
    // Mouse Parallax for Blobs & 3D Icons
    // ----------------------------------------
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        const blobs = document.querySelectorAll('.blob');
        blobs.forEach((blob, index) => {
            const speed = (index + 1) * 20;
            const xOffset = (x - 0.5) * speed;
            const yOffset = (y - 0.5) * speed;
            blob.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        });
    });

    // ----------------------------------------
    // Stickers Interaction - DISABLED
    // ----------------------------------------
    /*
    const stickers = ['⭐', '🔥', '🚀', '🎨', '💻', '✨'];
    document.addEventListener('click', (e) => {
        if (e.target.closest('button, a')) return; // Don't block real clicks

        const sticker = document.createElement('div');
        sticker.className = 'click-sticker';
        sticker.textContent = stickers[Math.floor(Math.random() * stickers.length)];
        sticker.style.left = `${e.clientX}px`;
        sticker.style.top = `${e.clientY}px`;
        document.body.appendChild(sticker);

        setTimeout(() => sticker.remove(), 1000);
    });
    */


    // ----------------------------------------
    // Navbar scroll effect
    // ----------------------------------------
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.scrollY;
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScroll = currentScroll;

        // ScrollSpy logic
        const sections = document.querySelectorAll('section');
        const navLinks = document.querySelectorAll('.nav-list .nav-link');
        
        let currentSectionId = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (scrollY >= (sectionTop - 200)) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}` || (!currentSectionId && link.getAttribute('href') === '#hero')) {
                link.classList.add('active');
            }
        });
    });

    // ----------------------------------------
    // Mobile nav toggle
    // ----------------------------------------
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    let navOverlay = document.querySelector('.nav-overlay');
    if (!navOverlay) {
        navOverlay = document.createElement('div');
        navOverlay.className = 'nav-overlay';
        document.body.appendChild(navOverlay);
    }

    if (navToggle && navMenu) {
        const toggleMenu = (e) => {
            if (e) e.stopPropagation();
            const isActive = navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            navOverlay.classList.toggle('active');
            document.body.style.overflow = isActive ? 'hidden' : '';
        };

        navToggle.addEventListener('click', toggleMenu);
        navOverlay.addEventListener('click', toggleMenu);

        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
                navOverlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // ----------------------------------------
    // Counter animation logic
    // ----------------------------------------
    function animateCounter(el) {
        // Read the attribute again to ensure we have the latest value (for dynamic count)
        const targetAttr = el.getAttribute('data-count');
        const target = parseInt(targetAttr, 10);
        
        if (isNaN(target) || target === 0) {
            // If it's 0, we should still "animate" or just show 0
            el.textContent = '0';
            return;
        }

        const duration = 2000;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(target * eased);
            if (progress < 1) requestAnimationFrame(update);
        }

        requestAnimationFrame(update);
    }

    // ----------------------------------------
    // Consolidated Intersection Observer
    // ----------------------------------------
    const observerOptions = {
        threshold: 0.05,
        rootMargin: '0px 0px -20px 0px'
    };

    const mainObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const target = entry.target;

                if (target.classList.contains('reveal')) {
                    target.classList.add('visible');
                }

                if (target.classList.contains('skill-fill')) {
                    target.classList.add('animate');
                }

                if (target.hasAttribute('data-count') && !target.classList.contains('counted')) {
                    // Small delay to ensure dynamic attributes are processed
                    setTimeout(() => animateCounter(target), 50);
                    target.classList.add('counted');
                }

                if (!target.classList.contains('animate-repeat')) {
                    mainObserver.unobserve(target);
                }
            }
        });
    }, observerOptions);

    // ----------------------------------------
    // Dynamic Stats & Project Counting
    // ----------------------------------------
    const projectCards = document.querySelectorAll('.project-card');
    const projectCount = projectCards.length;
    
    // Update Hero Project Stat
    const dynamicProjectCountNode = document.getElementById('dynamic-project-count');
    if (dynamicProjectCountNode && projectCount > 0) {
        dynamicProjectCountNode.setAttribute('data-count', projectCount);
    }
    
    // Update Projects Section Badge
    const projectCountBadge = document.getElementById('project-count-badge');
    if (projectCountBadge && projectCount > 0) {
        projectCountBadge.textContent = `(${projectCount})`;
    }
    
    // Dynamic Technologies Counting
    const skillCards = document.querySelectorAll('.skill-card');
    const techCount = skillCards.length;
    
    const techCountNode = document.getElementById('dynamic-tech-count');
    if (techCountNode && techCount > 0) {
        techCountNode.setAttribute('data-count', techCount);
    }

    // Register elements to observer
    document.querySelectorAll(
        '.service-card, .featured-card, .project-card, .skill-card, .timeline-item, ' +
        '.contact-method, .about-content, .about-image-card, .contact-form-wrapper'
    ).forEach(el => {
        el.classList.add('reveal');
        mainObserver.observe(el);
    });

    document.querySelectorAll('.skill-fill').forEach(el => mainObserver.observe(el));
    document.querySelectorAll('[data-count]').forEach(el => mainObserver.observe(el));

    // ----------------------------------------
    // Project filter tabs
    // ----------------------------------------
    const filterBtns = document.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');

            projectCards.forEach(card => {
                const category = card.getAttribute('data-category');
                if (filter === 'all' || category === filter) {
                    card.classList.remove('hidden-filter');
                    setTimeout(() => {
                        card.style.display = 'block';
                    }, 0);
                } else {
                    card.classList.add('hidden-filter');
                    setTimeout(() => {
                        if (card.classList.contains('hidden-filter')) {
                            card.style.display = 'none';
                        }
                    }, 400); // Match transition duration in CSS
                }
            });
        });
    });

    // ----------------------------------------
    // Contact form (with validation)
    // ----------------------------------------
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('email');
            const emailValue = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(emailValue)) {
                emailInput.parentElement.classList.add('error');
                setTimeout(() => emailInput.parentElement.classList.remove('error'), 2000);
                return;
            }

            const btn = contactForm.querySelector('button[type="submit"]');
            const originalHTML = btn.innerHTML;
            
            // Show loading state
            btn.innerHTML = '<span>Sending...</span> <i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;

            const formData = new FormData(contactForm);
            
            fetch(contactForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            }).then(response => {
                if (response.ok) {
                    btn.innerHTML = '<span>Message Sent!</span> <i class="fas fa-check"></i>';
                    btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
                    contactForm.reset();
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 5000);
                } else {
                    response.json().then(data => {
                        if (Object.hasOwn(data, 'errors')) {
                            alert(data["errors"].map(error => error["message"]).join(", "));
                        } else {
                            alert("Oops! There was a problem submitting your form");
                        }
                    });
                    btn.innerHTML = '<span>Error!</span> <i class="fas fa-times"></i>';
                    btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 3000);
                }
            }).catch(error => {
                alert("Oops! There was a problem submitting your form");
                btn.innerHTML = '<span>Error!</span> <i class="fas fa-times"></i>';
                btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);
            });
        });
    }

    // ----------------------------------------
    // Improved 3D Tilt effect - Expanded to all buttons/links
    // ----------------------------------------
    document.querySelectorAll('[data-tilt], .avatar-container, .btn, .nav-link, .project-card, .service-card, .contact-method, .social-icon, .footer-links a').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Subtler tilt for buttons
            const isButton = card.classList.contains('btn');
            const maxRotate = isButton ? 8 : 15;
            const rotateX = (y - centerY) / centerY * -maxRotate;
            const rotateY = (x - centerX) / centerX * maxRotate;
            
            card.style.transition = 'none';
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            
            // Move internal elements for depth
            const layers = card.querySelectorAll('.z-layer-1, .z-layer-2, .z-layer-3');
            layers.forEach(layer => {
                const depth = layer.classList.contains('z-layer-3') ? 40 : 
                              layer.classList.contains('z-layer-2') ? 20 : 10;
                const moveX = (x - centerX) / centerX * depth;
                const moveY = (y - centerY) / centerY * depth;
                layer.style.transform = `translateZ(${depth * 2}px) translate(${moveX}px, ${moveY}px)`;
            });
        });

        card.addEventListener('mouseleave', () => {
            card.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
            card.style.transform = '';
            
            const layers = card.querySelectorAll('.z-layer-1, .z-layer-2, .z-layer-3');
            layers.forEach(layer => {
                layer.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
                layer.style.transform = '';
            });
        });
    });
});

// Final fallback for when all assets (images, etc.) are fully loaded
window.addEventListener('load', function() {
    window.scrollTo({ top: 0, behavior: 'auto' });
});