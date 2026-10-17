// Shared by the seeker and employer dashboards so both produce the same score.
const aliases = { it: 'technology', 'information technology': 'technology', health: 'healthcare' };

export function matchReasons(profile, job) {
    if (!profile || !job) return [];
    const reasons = [];
    const skills = list(profile.skills) || [];
    const required = list(job.requiredSkills) || [];
    const shared = required.filter(skill => skills.some(own => own === skill));
    if (shared.length) reasons.push(`Skills: ${shared.slice(0, 3).join(', ')}`);
    if (profile.location && job.location && calculateLocationMatch(profile.location, job.location) >= 80) reasons.push('Preferred location');
    if ((list(profile.jobTypes) || []).includes(String(job.jobType || job.type).toLowerCase())) reasons.push('Preferred job type');
    if ((list(profile.categories) || []).some(category => (list(job.category) || []).includes(category))) reasons.push('Preferred field');
    return reasons;
}
function list(value) {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\n]+/) : [];
    const result = values.filter(item => typeof item === 'string').map(item => item.trim().toLowerCase()).filter(Boolean)
        .map(item => aliases[item] || item);
    return result.length ? result : null;
}

export function calculateMatchScore(profile, job) {
        if (!profile || !job) return 0;
        profile = { ...profile, jobTypes: list(profile.jobTypes), categories: list(profile.categories),
            industries: list(profile.industries), skills: list(profile.skills) };
        job = { ...job, jobType: String(job.jobType || job.type || '').toLowerCase(),
            category: list(job.category), industry: list(job.industry), requiredSkills: list(job.requiredSkills) };

        let score = 0;
        let totalWeight = 0;

        // Job Type Matching (25% weight)
        if (profile.jobTypes && job.jobType) {
            const userJobTypes = Array.isArray(profile.jobTypes) ? 
                profile.jobTypes : [profile.jobTypes];
            
            if (userJobTypes.includes(job.jobType)) {
                score += 100 * 0.25;
            } else {
                // Partial match for similar types
                const similarTypes = {
                    'full-time': ['part-time', 'contract'],
                    'part-time': ['full-time', 'contract'],
                    'contract': ['full-time', 'part-time'],
                    'remote': ['full-time', 'part-time', 'contract'],
                    'internship': ['full-time', 'part-time']
                };
                
                if (similarTypes[job.jobType]) {
                    const hasSimilar = userJobTypes.some(type => 
                        similarTypes[job.jobType].includes(type)
                    );
                    if (hasSimilar) score += 50 * 0.25;
                }
            }
            totalWeight += 0.25;
        }

        // Category Matching (25% weight)
        if (profile.categories && job.category) {
            const userCategories = Array.isArray(profile.categories) ? 
                profile.categories : [profile.categories];
            const jobCategories = Array.isArray(job.category) ? 
                job.category : [job.category];
            
            const matchingCategories = jobCategories.filter(cat => 
                userCategories.includes(cat)
            );
            
            if (matchingCategories.length > 0) {
                score += 100 * 0.25;
            } else {
                // Check for similar categories
                const categorySimilarity = calculateCategorySimilarity(userCategories, jobCategories);
                score += categorySimilarity * 0.25;
            }
            totalWeight += 0.25;
        }

        // Industry Matching (20% weight)
        if (profile.industries && job.industry) {
            const userIndustries = Array.isArray(profile.industries) ? 
                profile.industries : [profile.industries];
            const jobIndustries = Array.isArray(job.industry) ? 
                job.industry : [job.industry];
            
            const matchingIndustries = jobIndustries.filter(ind => 
                userIndustries.includes(ind)
            );
            
            if (matchingIndustries.length > 0) {
                score += 100 * 0.20;
            } else {
                // Check for similar industries
                const industrySimilarity = calculateIndustrySimilarity(userIndustries, jobIndustries);
                score += industrySimilarity * 0.20;
            }
            totalWeight += 0.20;
        }

        // Location Matching (20% weight)
        if (profile.location && job.location) {
            const locationMatch = calculateLocationMatch(profile.location, job.location);
            score += locationMatch * 0.20;
            totalWeight += 0.20;
        }

        // Skills Matching (10% weight)
        if (profile.skills && job.requiredSkills) {
            const userSkills = Array.isArray(profile.skills) ? 
                profile.skills : [profile.skills];
            const jobSkills = Array.isArray(job.requiredSkills) ? 
                job.requiredSkills : [job.requiredSkills];
            
            const matchingSkills = jobSkills.filter(skill => 
                userSkills.some(userSkill => 
                    userSkill.toLowerCase().includes(skill.toLowerCase()) ||
                    skill.toLowerCase().includes(userSkill.toLowerCase())
                )
            );
            
            const skillsScore = jobSkills.length > 0 ? 
                (matchingSkills.length / jobSkills.length) * 100 : 0;
            score += skillsScore * 0.10;
            totalWeight += 0.10;
        }

        const normalizedScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;
        return Math.max(0, Math.min(100, normalizedScore));
    }

export function calculateCategorySimilarity(userCategories, jobCategories) {
        // Define category groups for similarity calculation
        const categoryGroups = {
            'technology': ['software-development', 'web-development', 'mobile-development', 'data-science', 'ai-ml'],
            'design': ['graphic-design', 'ui-ux-design', 'web-design', 'product-design'],
            'business': ['marketing', 'sales', 'business-development', 'project-management'],
            'finance': ['accounting', 'finance', 'banking', 'investment'],
            'healthcare': ['nursing', 'medical', 'healthcare', 'pharmaceutical']
        };

        let maxSimilarity = 0;
        
        userCategories.forEach(userCat => {
            jobCategories.forEach(jobCat => {
                let similarity = 0;
                
                // Exact match
                if (userCat === jobCat) {
                    similarity = 100;
                } else {
                    // Check if they belong to the same group
                    for (const group in categoryGroups) {
                        const groupCategories = categoryGroups[group];
                        if (groupCategories.includes(userCat) && groupCategories.includes(jobCat)) {
                            similarity = 75;
                            break;
                        }
                    }
                    
                    // Check for partial string match
                    if (similarity === 0) {
                        const userWords = userCat.toLowerCase().split(/[-_ ]/);
                        const jobWords = jobCat.toLowerCase().split(/[-_ ]/);
                        const commonWords = userWords.filter(word => 
                            jobWords.some(jobWord => calculateSimilarity(word, jobWord) > 0.7)
                        );
                        
                        if (commonWords.length > 0) {
                            similarity = 50;
                        }
                    }
                }
                
                maxSimilarity = Math.max(maxSimilarity, similarity);
            });
        });
        
        return maxSimilarity;
    }

export function calculateIndustrySimilarity(userIndustries, jobIndustries) {
        // Define industry groups for similarity calculation
        const industryGroups = {
            'technology': ['software', 'hardware', 'internet', 'telecommunications', 'it-services'],
            'finance': ['banking', 'insurance', 'investment', 'financial-services'],
            'healthcare': ['hospitals', 'pharmaceuticals', 'medical-devices', 'healthcare-services'],
            'retail': ['e-commerce', 'consumer-goods', 'fashion', 'retail-services'],
            'manufacturing': ['automotive', 'industrial', 'construction', 'energy']
        };

        let maxSimilarity = 0;
        
        userIndustries.forEach(userInd => {
            jobIndustries.forEach(jobInd => {
                let similarity = 0;
                
                // Exact match
                if (userInd === jobInd) {
                    similarity = 100;
                } else {
                    // Check if they belong to the same group
                    for (const group in industryGroups) {
                        const groupIndustries = industryGroups[group];
                        if (groupIndustries.includes(userInd) && groupIndustries.includes(jobInd)) {
                            similarity = 75;
                            break;
                        }
                    }
                    
                    // Check for partial string match
                    if (similarity === 0) {
                        const userWords = userInd.toLowerCase().split(/[-_ ]/);
                        const jobWords = jobInd.toLowerCase().split(/[-_ ]/);
                        const commonWords = userWords.filter(word => 
                            jobWords.some(jobWord => calculateSimilarity(word, jobWord) > 0.7)
                        );
                        
                        if (commonWords.length > 0) {
                            similarity = 50;
                        }
                    }
                }
                
                maxSimilarity = Math.max(maxSimilarity, similarity);
            });
        });
        
        return maxSimilarity;
    }

export function calculateLocationMatch(userLocation, jobLocation) {
        if (!userLocation || !jobLocation) return 0;
        
        const userLoc = userLocation.toLowerCase().trim();
        const jobLoc = jobLocation.toLowerCase().trim();
        
        // Exact match
        if (userLoc === jobLoc) return 100;
        
        // Check for same city/state
        const userParts = userLoc.split(',');
        const jobParts = jobLoc.split(',');
        
        if (userParts.length > 0 && jobParts.length > 0) {
            const userCity = userParts[0].trim();
            const jobCity = jobParts[0].trim();
            
            if (userCity === jobCity) return 90;
            
            // Check for similar city names
            if (calculateSimilarity(userCity, jobCity) > 0.8) return 80;
        }
        
        // Check for same state
        if (userParts.length > 1 && jobParts.length > 1) {
            const userState = userParts[1].trim();
            const jobState = jobParts[1].trim();
            
            if (userState === jobState) return 70;
        }
        
        // Check for remote work
        if (jobLoc.includes('remote') || jobLoc.includes('anywhere')) return 60;
        
        // Check for same country
        const userCountry = userParts[userParts.length - 1].trim();
        const jobCountry = jobParts[jobParts.length - 1].trim();
        
        if (userCountry === jobCountry) return 50;
        
        return 0;
    }

export function calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        return (longer.length - editDistance(longer, shorter)) / parseFloat(longer.length);
    }

export function editDistance(s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
        
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }
