"use client"

import Link from "next/link"
import { ArrowRight, MousePointer, FileText, Zap, CheckCircle, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${350 + i * 8}C-${
      380 - i * 5 * position
    } -${350 + i * 8} -${312 - i * 5 * position} ${150 - i * 4} ${
      200 - i * 3 * position
    } ${280 - i * 5}C${650 - i * 4 * position} ${420 - i * 6} ${
      750 - i * 3 * position
    } ${800 - i * 5} ${750 - i * 3 * position} ${800 - i * 5}`,
    color: `rgba(15,23,42,${0.1 + i * 0.03})`,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full text-black/20" viewBox="0 0 800 600" fill="none">
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.02}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.4, 0.7, 0.4],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  )
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-sm border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 bg-black rounded-md transform rotate-45"></div>
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold">T</div>
            </div>
            <span className="text-2xl font-bold tracking-tighter text-black">
              Trace
            </span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link href="#features" className="text-sm font-medium hover:text-blue-600 transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium hover:text-blue-600 transition-colors">
              How It Works
            </Link>
            <Link href="#use-cases" className="text-sm font-medium hover:text-blue-600 transition-colors">
              Use Cases
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:text-blue-600 transition-colors">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="hidden md:flex">
              Log In
            </Button>
            <Button
              size="sm"
              className="bg-black text-white hover:bg-gray-800"
            >
              Try It Free
            </Button>
          </div>
        </div>
      </div>
      <main className="flex-1 pt-16">
        <section className="w-full py-12 md:py-24 lg:py-32 relative overflow-hidden bg-white text-black">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
          
          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center text-center space-y-4 mb-24">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter">
                Follow the{" "}
                <span className="text-blue-600">
                  Trace
                </span>
              </h1>
              <p className="max-w-[800px] text-xl md:text-2xl text-gray-600">
                Capture your workflow. Create documentation in seconds, not hours.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <Button className="bg-black text-white hover:bg-gray-800 text-lg h-12 px-8">
                  Download Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" className="border-black text-black hover:bg-black hover:text-white text-lg h-12 px-8">
                  Watch Demo
                  <Play className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <div className="flex -space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white"
                    />
                  ))}
                </div>
                <span className="text-gray-600">Join 10,000+ users documenting smarter</span>
              </div>
            </div>

            <div className="relative mx-auto max-w-5xl mb-24">
              <div className="bg-gray-100 rounded-xl p-2 shadow-2xl border border-gray-200">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
                      <Play className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent"></div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className="text-white font-bold">T</span>
                      </div>
                      <span className="text-white font-medium">Creating your first documentation</span>
                    </div>
                    <div className="text-white/80 text-sm">02:45</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center text-center space-y-4 mb-12">
              <div className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                Endless Possibilities
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
                How will your team use <span className="text-blue-600">Trace</span>?
              </h2>
              <p className="max-w-[600px] text-gray-500 md:text-xl">
                Select your use case and see how Trace can transform your documentation process.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <FileText className="h-6 w-6" />
                    </div>
                  ),
                  title: "Create SOPs",
                  description: "Build standard operating procedures in minutes instead of hours.",
                },
                {
                  icon: (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <MousePointer className="h-6 w-6" />
                    </div>
                  ),
                  title: "Onboard New Hires",
                  description: "Get new team members up to speed with visual, step-by-step guides.",
                },
                {
                  icon: (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <Zap className="h-6 w-6" />
                    </div>
                  ),
                  title: "Build Training Docs",
                  description: "Create comprehensive training materials that actually get used.",
                },
              ].map((item, i) => (
                <Card
                  key={i}
                  className="group relative overflow-hidden border-2 hover:border-blue-400 transition-colors bg-white/80 backdrop-blur-sm"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="p-6 flex flex-col items-center text-center space-y-4">
                    {item.icon}
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="text-gray-500">{item.description}</p>
                    <Button
                      variant="ghost"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-0 h-auto"
                    >
                      Learn more
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-12 md:py-24 bg-gray-50 relative overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
          </div>
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center text-center space-y-4 mb-12">
              <div className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                Powerful Features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
                Trace your path to <span className="text-blue-600">perfect documentation</span>
              </h2>
              <p className="max-w-[600px] text-gray-500 md:text-xl">
                Intelligent capture and professional annotations make documentation a breeze.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                {[
                  {
                    title: "Intelligent Screen Capture",
                    description:
                      "Automatically captures screenshots at key moments with advanced buffering for perfect timing.",
                  },
                  {
                    title: "Professional Annotations",
                    description: "Add arrows, highlights, and callouts to make your instructions crystal clear.",
                  },
                  {
                    title: "Instant Organization",
                    description: "Steps are automatically organized into a coherent flow with timestamps and context.",
                  },
                ].map((feature, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                      <p className="text-gray-500">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative">
                <div className="relative bg-white rounded-xl shadow-xl border p-2 z-10 transform md:rotate-3 transition-transform hover:rotate-0">
                  <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                    <div className="h-8 bg-gray-200 flex items-center px-4 gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div className="text-xs text-gray-500 ml-2">Trace - Documentation</div>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="h-8 bg-gray-200 rounded w-full"></div>
                        <div className="flex gap-4">
                          <div className="w-1/3 h-24 bg-gray-200 rounded"></div>
                          <div className="w-2/3 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white">
                    <MousePointer className="h-6 w-6" />
                  </div>
                </div>
                <div className="absolute top-8 -right-8 bg-white rounded-xl shadow-xl border p-2 z-0 transform md:rotate-6 transition-transform hover:rotate-0">
                  <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden">
                    <div className="h-8 bg-gray-200 flex items-center px-4 gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-col gap-4">
                        <div className="h-8 bg-gray-200 rounded w-full"></div>
                        <div className="flex gap-4">
                          <div className="w-1/3 h-24 bg-gray-200 rounded"></div>
                          <div className="w-2/3 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-blue-600 rounded-full blur-2xl opacity-30"></div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="w-full py-12 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>
            <div className="absolute top-1/2 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-gray-200 to-transparent"></div>
            <div className="absolute top-1/2 left-2/4 w-px h-full bg-gradient-to-b from-transparent via-gray-200 to-transparent"></div>
            <div className="absolute top-1/2 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-gray-200 to-transparent"></div>
          </div>
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center text-center space-y-4 mb-12">
              <div className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                Simple Process
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
                <span className="text-blue-600">Three steps</span> to perfect documentation
              </h2>
              <p className="max-w-[600px] text-gray-500 md:text-xl">
                Creating documentation is as simple as using your computer normally.
              </p>
            </div>
            <div className="relative">
              <div className="absolute top-0 left-1/2 w-1 h-full bg-blue-600 hidden lg:block transform -translate-x-1/2"></div>
              <div className="space-y-12 lg:space-y-0 relative">
                {[
                  {
                    title: "Start Recording",
                    description: "Launch Trace and start a new recording session for your workflow.",
                    image: (
                      <div className="w-full h-full bg-blue-100 rounded-xl flex items-center justify-center p-6">
                        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white">
                          <Play className="h-8 w-8" />
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Perform Your Task",
                    description: "Work normally while Trace captures your actions in the background.",
                    image: (
                      <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center p-6">
                        <div className="relative w-full max-w-[200px] aspect-square">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <MousePointer className="h-12 w-12 text-blue-600 animate-pulse" />
                          </div>
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#dbeafe" strokeWidth="2" />
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="2"
                              strokeDasharray="283"
                              strokeDashoffset="100"
                              className="animate-[dash_3s_linear_infinite]"
                            />
                          </svg>
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: "Export & Share",
                    description: "Review, annotate, and export your documentation in minutes.",
                    image: (
                      <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center p-6">
                        <div className="relative w-full max-w-[200px] aspect-square flex items-center justify-center">
                          <div className="absolute w-32 h-40 bg-white rounded-lg shadow-lg transform -rotate-6 border"></div>
                          <div className="absolute w-32 h-40 bg-white rounded-lg shadow-lg transform rotate-6 border"></div>
                          <div className="relative w-32 h-40 bg-white rounded-lg shadow-lg border flex flex-col p-2">
                            <div className="h-4 bg-blue-200 rounded w-1/2 mb-2"></div>
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="h-2 bg-gray-200 rounded w-full"></div>
                              <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                              <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                ].map((step, i) => (
                  <div
                    key={i}
                    className={`flex flex-col lg:flex-row gap-8 items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
                  >
                    <div className="lg:w-1/2 flex justify-center">
                      <div className="w-full max-w-md aspect-square">{step.image}</div>
                    </div>
                    <div className="lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
                      <div className="relative">
                        <div className="hidden lg:block absolute top-1/2 transform -translate-y-1/2 -translate-x-16 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
                          {i + 1}
                        </div>
                        <div className="lg:hidden mb-4 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
                          {i + 1}
                        </div>
                        <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                        <p className="text-gray-500 text-lg max-w-md">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="testimonials"
          className="w-full py-12 md:py-24 bg-black text-white"
        >
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4 mb-12">
              <div className="inline-block rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-sm font-medium text-white">
                Trusted by Teams Everywhere
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
                See what people are saying about{" "}
                <span className="text-blue-400">
                  Trace
                </span>
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote: "Trace has cut our documentation time by 80%. What used to take days now takes hours.",
                  author: "Sarah Johnson",
                  role: "Training Manager",
                  company: "TechCorp",
                },
                {
                  quote:
                    "The automatic screen capture is like magic. It's like having a documentation expert on the team.",
                  author: "Michael Chen",
                  role: "IT Director",
                  company: "Global Solutions",
                },
                {
                  quote:
                    "Our onboarding process is now seamless thanks to Trace. New hires get up to speed twice as fast.",
                  author: "Emily Rodriguez",
                  role: "HR Specialist",
                  company: "Innovate Inc.",
                },
              ].map((testimonial, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 relative">
                  <div className="absolute -top-3 -left-3 text-5xl text-white/20">"</div>
                  <div className="relative z-10">
                    <p className="mb-4 text-white/90">{testimonial.quote}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className="font-bold text-white">{testimonial.author[0]}</span>
                      </div>
                      <div>
                        <div className="font-medium">{testimonial.author}</div>
                        <div className="text-sm text-white/70">
                          {testimonial.role}, {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-16 flex flex-wrap justify-center gap-8 items-center">
              {["Amazon", "Microsoft", "Google", "Adobe", "Shopify"].map((company, i) => (
                <div key={i} className="text-xl font-bold text-white/40">
                  {company}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="w-full py-12 md:py-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-to-bl from-blue-100 rounded-bl-full opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-gray-100 rounded-tr-full opacity-50"></div>
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center text-center space-y-4 mb-12">
              <div className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                Pricing Plans
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
                Choose the perfect <span className="text-blue-600">plan</span> for your team
              </h2>
              <p className="max-w-[600px] text-gray-500 md:text-xl">
                Simple, transparent pricing that scales with your needs.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  name: "Starter",
                  price: "$9",
                  description: "Perfect for individual users",
                  features: ["Unlimited projects", "Basic annotations", "PDF export", "Email support"],
                  cta: "Get Started",
                  popular: false,
                },
                {
                  name: "Professional",
                  price: "$19",
                  description: "For power users who need more",
                  features: [
                    "Everything in Starter",
                    "Advanced annotations",
                    "Word & PDF export",
                    "Custom templates",
                    "Priority support",
                  ],
                  cta: "Get Started",
                  popular: true,
                },
                {
                  name: "Team",
                  price: "$49",
                  description: "For teams of all sizes",
                  features: [
                    "Everything in Professional",
                    "Team collaboration",
                    "Shared library",
                    "Admin controls",
                    "API access",
                    "Dedicated support",
                  ],
                  cta: "Contact Sales",
                  popular: false,
                },
              ].map((plan, i) => (
                <div
                  key={i}
                  className={`relative rounded-xl overflow-hidden ${plan.popular ? "transform scale-105 shadow-xl" : "border shadow-sm"}`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-center py-1 text-sm font-medium">
                      Most Popular
                    </div>
                  )}
                  <div className={`p-6 ${plan.popular ? "pt-8" : ""}`}>
                    <div className="space-y-4">
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold">{plan.price}</span>
                        <span className="ml-1 text-gray-500">/month</span>
                      </div>
                      <p className="text-gray-500">{plan.description}</p>
                      <ul className="space-y-3">
                        {plan.features.map((feature, j) => (
                          <li key={j} className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className={`w-full ${plan.popular ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                      >
                        {plan.cta}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 bg-black text-white">
          <div className="container px-4 md:px-6">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to transform your documentation process?</h2>
                <p className="text-white/80 text-lg mb-6">
                  Join thousands of users who save hours every week with Trace.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button className="bg-white text-black hover:bg-gray-100 text-lg h-12 px-8">
                    Download Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black text-lg h-12 px-8">
                    Schedule Demo
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="2" fill="none" />
                    <circle cx="50" cy="50" r="30" stroke="white" strokeWidth="2" fill="none" />
                    <circle cx="50" cy="50" r="20" stroke="white" strokeWidth="2" fill="none" />
                  </svg>
                </div>
                <div className="relative flex flex-col items-center gap-4">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border border-white/30 max-w-md">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <span className="font-bold text-black">T</span>
                      </div>
                      <div className="font-medium">Trace Stats</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">80%</div>
                        <div className="text-xs text-white/70">Time Saved</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">10k+</div>
                        <div className="text-xs text-white/70">Users</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">1M+</div>
                        <div className="text-xs text-white/70">Docs Created</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex -space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-white border-2 border-black" />
                      ))}
                    </div>
                    <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                      <span className="text-white text-xs">1,000,000+ installs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-white">
        <div className="container flex flex-col gap-6 py-8 md:py-12 px-4 md:px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:gap-12">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 bg-black rounded-md transform rotate-45"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-white font-bold">T</div>
                </div>
                <span className="text-2xl font-bold tracking-tighter text-black">
                  Trace
                </span>
              </div>
              <p className="text-gray-500 md:w-[400px]">
                Automate documentation creation through intelligent screen recording and annotation.
              </p>
            </div>
            <div className="flex flex-wrap gap-8 lg:gap-12">
              <div className="space-y-3">
                <h4 className="text-base font-medium">Product</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      Download
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="text-base font-medium">Company</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      Careers
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="text-base font-medium">Support</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      Help Center
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link href="#" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                      Privacy
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6 md:flex-row md:gap-0 md:justify-between md:items-center">
            <p className="text-sm text-gray-500">© 2025 Trace. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
