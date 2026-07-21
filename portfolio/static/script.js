// ==========================================================================
// Apple-Inspired Developer Portfolio Interactivity (GSAP, Lenis, Spotlight)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. Lenis Smooth Scrolling Initialization
    // -------------------------------------------------------------
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Apple-like ease out
        smoothWheel: true,
        smoothTouch: false,
        infinite: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // Integrate Lenis scroll events with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // -------------------------------------------------------------
    // 2. Preloader & Page Entrance Animation
    // -------------------------------------------------------------
    const loader = document.getElementById('loader');
    
    // Fallback timer if window load event is delayed
    const fallbackTimeout = setTimeout(() => {
        hideLoader();
    }, 3000);

    window.addEventListener('load', () => {
        clearTimeout(fallbackTimeout);
        hideLoader();
    });

    function hideLoader() {
        if (!loader || loader.classList.contains('opacity-0')) return;
        
        // GSAP animate loader fadeout
        gsap.to(loader, {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            onComplete: () => {
                loader.style.display = 'none';
                triggerHeroEntrance();
            }
        });
    }

    function triggerHeroEntrance() {
        // Slide up hero reveals sequentially
        gsap.to('.hero-reveal', {
            y: 0,
            opacity: 1,
            duration: 1.2,
            stagger: 0.15,
            ease: 'power4.out',
            clearProps: 'transform' // Clear inline transform so parallax works
        });
    }

    // -------------------------------------------------------------
    // 3. Custom Cursor Follower
    // -------------------------------------------------------------
    const cursorDot = document.getElementById('customCursorDot');
    const cursorRing = document.getElementById('customCursorRing');
    
    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Position the small central dot instantly
        if (cursorDot) {
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
        }
    });

    // Smoothly interpolate the outer ring coordinates (lerp)
    function animateCursorRing() {
        const lerpFactor = 0.15;
        ringX += (mouseX - ringX) * lerpFactor;
        ringY += (mouseY - ringY) * lerpFactor;

        if (cursorRing) {
            cursorRing.style.left = `${ringX}px`;
            cursorRing.style.top = `${ringY}px`;
        }

        requestAnimationFrame(animateCursorRing);
    }
    requestAnimationFrame(animateCursorRing);

    // Hover states for interactive elements
    const interactiveSelectors = 'a, button, input, textarea, select, .magnetic-btn, [role="button"]';
    document.body.addEventListener('mouseenter', (e) => {
        if (e.target.matches(interactiveSelectors) || e.target.closest(interactiveSelectors)) {
            document.body.classList.add('cursor-hover');
        }
    }, true);

    document.body.addEventListener('mouseleave', (e) => {
        if (e.target.matches(interactiveSelectors) || e.target.closest(interactiveSelectors)) {
            document.body.classList.remove('cursor-hover');
        }
    }, true);

    // -------------------------------------------------------------
    // 4. Mouse-Follow Spotlight (Cards Glow)
    // -------------------------------------------------------------
    const hoverGlowElements = document.querySelectorAll('.hover-glow');
    hoverGlowElements.forEach((el) => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            el.style.setProperty('--mouse-x', `${x}px`);
            el.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // -------------------------------------------------------------
    // 5. Magnetic Buttons Attraction
    // -------------------------------------------------------------
    const magneticButtons = document.querySelectorAll('.magnetic-btn');
    magneticButtons.forEach((btn) => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Pull coordinates (max 12px shift for subtle elegance)
            gsap.to(btn, {
                x: x * 0.3,
                y: y * 0.3,
                duration: 0.3,
                ease: 'power2.out'
            });
        });

        btn.addEventListener('mouseleave', () => {
            // Elastic rebound snap back
            gsap.to(btn, {
                x: 0,
                y: 0,
                duration: 0.6,
                ease: 'elastic.out(1, 0.4)'
            });
        });
    });

    // -------------------------------------------------------------
    // 6. GSAP ScrollTriggers & Reveal Animations
    // -------------------------------------------------------------
    gsap.registerPlugin(ScrollTrigger);

    // Scroll Progress Indicator
    gsap.to('#scrollProgress', {
        width: '100%',
        ease: 'none',
        scrollTrigger: {
            trigger: 'body',
            start: 'top top',
            end: 'bottom bottom',
            scrub: true
        }
    });

    // Section Titles Reveal
    const sectionHeaders = document.querySelectorAll('.section-header');
    sectionHeaders.forEach((header) => {
        gsap.from(header.children, {
            y: 40,
            opacity: 0,
            filter: 'blur(10px)',
            duration: 1,
            stagger: 0.15,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: header,
                start: 'top 85%',
                toggleActions: 'play none none none'
            }
        });
    });

    // About Section Cards
    const aboutCards = document.querySelectorAll('#about > div:nth-child(2) > div');
    gsap.from(aboutCards, {
        y: 60,
        opacity: 0,
        filter: 'blur(12px)',
        duration: 1.2,
        stagger: 0.2,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '#about',
            start: 'top 75%',
            toggleActions: 'play none none none'
        }
    });

    // Bento Grid Cards Reveal
    const bentoCards = document.querySelectorAll('.skill-bento-card');
    gsap.from(bentoCards, {
        scale: 0.95,
        y: 40,
        opacity: 0,
        filter: 'blur(8px)',
        duration: 1,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '#skills',
            start: 'top 75%',
            toggleActions: 'play none none none'
        }
    });

    // Project Cards Reveal
    const projectReveals = document.querySelectorAll('.project-reveal');
    projectReveals.forEach((project) => {
        const visual = project.querySelector('.project-visual') || project.querySelector('div:first-child');
        const text = project.querySelector('.project-text') || project.querySelector('div:nth-child(2)');

        if (visual) {
            gsap.from(visual, {
                y: 40,
                opacity: 0,
                filter: 'blur(10px)',
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: project,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                },
                clearProps: 'all'
            });
        }

        if (text) {
            gsap.from(text, {
                y: 40,
                opacity: 0,
                filter: 'blur(10px)',
                duration: 1,
                delay: 0.15,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: project,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                },
                clearProps: 'all'
            });
        }
    });

    // Experience Timeline Reveals
    const timelineItems = document.querySelectorAll('.timeline-reveal');
    timelineItems.forEach((item) => {
        const dot = item.querySelector('div:first-child');
        const card = item.querySelector('div:nth-child(2)');

        gsap.from(dot, {
            scale: 0,
            opacity: 0,
            duration: 0.6,
            ease: 'back.out(2)',
            scrollTrigger: {
                trigger: item,
                start: 'top 85%'
            }
        });

        gsap.from(card, {
            x: 30,
            opacity: 0,
            filter: 'blur(10px)',
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: item,
                start: 'top 85%'
            }
        });
    });

    // Contact Form Card Reveal
    gsap.from('#contact > div:nth-child(2)', {
        y: 50,
        opacity: 0,
        filter: 'blur(15px)',
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: '#contact',
            start: 'top 80%'
        }
    });

    // Stats Dynamic Counters
    const statCounters = document.querySelectorAll('.animate-on-scroll-count');
    statCounters.forEach((stat) => {
        const target = parseInt(stat.getAttribute('data-count'), 10);
        gsap.fromTo(stat, { textContent: 0 }, {
            textContent: target,
            duration: 2.2,
            snap: { textContent: 1 },
            ease: 'power2.out',
            scrollTrigger: {
                trigger: stat,
                start: 'top 90%',
                toggleActions: 'play none none none'
            }
        });
    });

    // Parallax Scrolling effect on Hero background blobs
    window.addEventListener('scroll', () => {
        const depthFactor = 0.15;
        const scrollY = window.scrollY;
        
        // Parallax shifting floating hero containers
        const floatingElements = document.querySelectorAll('.floating-element');
        floatingElements.forEach((el, index) => {
            const factor = (index + 1) * 0.1;
            el.style.transform = `translateY(${scrollY * factor}px)`;
        });
    });

    // -------------------------------------------------------------
    // 7. Navbar scroll-shrinking & Active Section ScrollSpy
    // -------------------------------------------------------------
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');

    window.addEventListener('scroll', () => {
        // Glass container padding resizing on scroll
        if (window.scrollY > 40) {
            navbar.style.top = '12px';
        } else {
            navbar.style.top = '24px';
        }

        // Section active status highlights
        let currentSectionId = 'hero';
        sections.forEach((section) => {
            const top = section.offsetTop - 180;
            const height = section.offsetHeight;
            if (window.scrollY >= top && window.scrollY < top + height) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach((link) => {
            link.classList.remove('active-nav');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active-nav');
            }
        });
    });

    // Smooth anchor navigation override via Lenis
    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                lenis.scrollTo(targetElement, { offset: -60 });
            }
        });
    });

    // -------------------------------------------------------------
    // 8. Mobile Navigation Hamburger Menu Interaction
    // -------------------------------------------------------------
    const navToggle = document.getElementById('navToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    
    // Burger toggle line indicators
    const line1 = document.getElementById('navToggleLine1');
    const line2 = document.getElementById('navToggleLine2');
    const line3 = document.getElementById('navToggleLine3');

    let menuOpen = false;

    if (navToggle && mobileMenu) {
        navToggle.addEventListener('click', () => {
            menuOpen = !menuOpen;
            
            if (menuOpen) {
                // Show menu overlay
                mobileMenu.classList.remove('hidden');
                setTimeout(() => {
                    mobileMenu.classList.remove('scale-95', 'opacity-0');
                    mobileMenu.classList.add('scale-100', 'opacity-100');
                }, 10);

                // Morph burger lines to X mark
                gsap.to(line1, { y: 8, rotate: 45, duration: 0.3 });
                gsap.to(line2, { opacity: 0, duration: 0.2 });
                gsap.to(line3, { y: -8, rotate: -45, duration: 0.3 });
            } else {
                closeMobileMenu();
            }
        });

        // Close menu on overlay link selections
        const mobileLinks = mobileMenu.querySelectorAll('.mobile-nav-link');
        mobileLinks.forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                closeMobileMenu();
                
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    // Delay slightly to let menu exit transition conclude
                    setTimeout(() => {
                        lenis.scrollTo(targetElement, { offset: -50 });
                    }, 350);
                }
            });
        });
    }

    function closeMobileMenu() {
        if (!mobileMenu || !menuOpen) return;
        menuOpen = false;

        mobileMenu.classList.remove('scale-100', 'opacity-100');
        mobileMenu.classList.add('scale-95', 'opacity-0');
        
        // Morph back to three line burger
        gsap.to(line1, { y: 0, rotate: 0, duration: 0.3 });
        gsap.to(line2, { opacity: 1, duration: 0.2 });
        gsap.to(line3, { y: 0, rotate: 0, duration: 0.3 });

        setTimeout(() => {
            if (!menuOpen) mobileMenu.classList.add('hidden');
        }, 300);
    }

    // -------------------------------------------------------------
    // 9. Contact Form AJAX Submission (Formspree Integration)
    // -------------------------------------------------------------
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');

    if (contactForm && submitBtn) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const btnText = submitBtn.querySelector('span');
            const originalHTML = submitBtn.innerHTML;
            
            // Set loading spinner state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Sending...</span> <i class="fas fa-spinner fa-spin ml-2"></i>';

            const formData = new FormData(contactForm);
            
            fetch(contactForm.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            })
            .then(response => {
                if (response.ok) {
                    submitBtn.innerHTML = '<span>Message Sent!</span> <i class="fas fa-check ml-2"></i>';
                    submitBtn.classList.remove('bg-white', 'text-black');
                    submitBtn.classList.add('bg-green-600', 'text-white');
                    contactForm.reset();
                    
                    setTimeout(() => {
                        submitBtn.innerHTML = originalHTML;
                        submitBtn.classList.remove('bg-green-600', 'text-white');
                        submitBtn.classList.add('bg-white', 'text-black');
                        submitBtn.disabled = false;
                    }, 4000);
                } else {
                    throw new Error('Error submitting form');
                }
            })
            .catch(() => {
                submitBtn.innerHTML = '<span>Failed to Send</span> <i class="fas fa-times ml-2"></i>';
                submitBtn.classList.remove('bg-white', 'text-black');
                submitBtn.classList.add('bg-red-600', 'text-white');
                
                setTimeout(() => {
                    submitBtn.innerHTML = originalHTML;
                    submitBtn.classList.remove('bg-red-600', 'text-white');
                    submitBtn.classList.add('bg-white', 'text-black');
                    submitBtn.disabled = false;
                }, 3000);
            });
        });
    }
});